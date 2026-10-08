package model

import (
	"math"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/expr-lang/expr/ast"
	"github.com/expr-lang/expr/parser"
)

type historicalPriceKey struct {
	Expression string
	Tier       string
	Group      float64
}

var historicalPriceCache = struct {
	sync.Mutex
	Prices map[historicalPriceKey]map[string]float64
}{Prices: make(map[historicalPriceKey]map[string]float64)}

// Recover rates from the saved expression and settled tier, never today's
// configuration or clock. Request rules lack their historical multiplier in
// old logs, so they cannot safely be reconstructed here.
func historicalExpressionPrices(expression, matchedTier string, group float64) map[string]float64 {
	if strings.Contains(expression, "|||") || len(expression) > 65536 || group < 0 || math.IsNaN(group) || math.IsInf(group, 0) {
		return nil
	}
	key := historicalPriceKey{expression, matchedTier, group}
	historicalPriceCache.Lock()
	defer historicalPriceCache.Unlock()
	if prices, ok := historicalPriceCache.Prices[key]; ok {
		return prices
	}
	prices := extractHistoricalExpressionPrices(expression, matchedTier, group)
	if len(historicalPriceCache.Prices) >= 256 {
		historicalPriceCache.Prices = make(map[historicalPriceKey]map[string]float64)
	}
	historicalPriceCache.Prices[key] = prices
	return prices
}

func extractHistoricalExpressionPrices(expression, matchedTier string, group float64) map[string]float64 {
	_, body := billingexpr.ParseExprVersion(expression)
	tree, err := parser.Parse(body)
	if err != nil {
		return nil
	}
	var node ast.Node
	if matchedTier == "" {
		node = tree.Node
	} else {
		candidates := historicalTierExpressions(tree.Node, matchedTier)
		if len(candidates) != 1 {
			return nil
		}
		node = candidates[0]
	}
	coefficients, constant, ok := historicalLinearPrices(node)
	if !ok || constant != 0 || len(coefficients) == 0 {
		return nil
	}
	prices := make(map[string]float64)
	for variable, coefficient := range coefficients {
		price := coefficient * group
		if coefficient < 0 || math.IsNaN(price) || math.IsInf(price, 0) {
			return nil
		}
		switch variable {
		case "p":
			prices["input"] = price
		case "c":
			prices["output"] = price
		case "cr":
			prices["cache_read"] = price
		case "cc":
			prices["cache_write"] = price
			prices["cache_write_5m"] = price
		case "cc1h":
			prices["cache_write_1h"] = price
		}
	}
	return prices
}

// Only follow pricing branches. Searching arbitrary nested calls could discard
// an outer multiplier or return a tier appearing only in a condition.
func historicalTierExpressions(node ast.Node, name string) []ast.Node {
	switch n := node.(type) {
	case *ast.ConditionalNode:
		return append(historicalTierExpressions(n.Exp1, name), historicalTierExpressions(n.Exp2, name)...)
	case *ast.CallNode:
		callee, ok := n.Callee.(*ast.IdentifierNode)
		if !ok || callee.Value != "tier" || len(n.Arguments) != 2 {
			return nil
		}
		label, ok := n.Arguments[0].(*ast.StringNode)
		if ok && label.Value == name {
			return []ast.Node{n.Arguments[1]}
		}
	}
	return nil
}

// Accept only affine token expressions with numeric coefficients. Nonlinear
// prices, request parameters, and fixed fees remain unknown rather than being
// presented as a fabricated per-token rate.
func historicalLinearPrices(node ast.Node) (map[string]float64, float64, bool) {
	switch n := node.(type) {
	case *ast.IntegerNode:
		return map[string]float64{}, float64(n.Value), true
	case *ast.FloatNode:
		return map[string]float64{}, n.Value, true
	case *ast.IdentifierNode:
		switch n.Value {
		case "p", "c", "cr", "cc", "cc1h", "img", "img_o", "ai", "ao":
			return map[string]float64{n.Value: 1}, 0, true
		}
	case *ast.BinaryNode:
		left, lc, lok := historicalLinearPrices(n.Left)
		right, rc, rok := historicalLinearPrices(n.Right)
		if !lok || !rok {
			return nil, 0, false
		}
		switch n.Operator {
		case "+", "-":
			factor := 1.0
			if n.Operator == "-" {
				factor = -1
			}
			for key, value := range right {
				left[key] += factor * value
			}
			return left, lc + factor*rc, true
		case "*":
			if len(left) == 0 {
				left, right, lc, rc = right, left, rc, lc
			}
			if len(right) != 0 {
				return nil, 0, false
			}
			for key := range left {
				left[key] *= rc
			}
			return left, lc * rc, true
		case "/":
			if len(right) != 0 || rc == 0 {
				return nil, 0, false
			}
			for key := range left {
				left[key] /= rc
			}
			return left, lc / rc, true
		}
	}
	return nil, 0, false
}
