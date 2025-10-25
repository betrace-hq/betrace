package dsl

import "testing"

func TestDebugGrouping(t *testing.T) {
	input := "(trace.has(a))"
	l := NewLexer(input)
	
	t.Log("=== Tokens ===")
	for {
		tok := l.NextToken()
		t.Logf("%s: %q", tok.Type, tok.Literal)
		if tok.Type == EOF {
			break
		}
	}
	
	t.Log("\n=== Parsing ===")
	p := NewParser(input)
	rule, err := p.Parse()
	if err != nil {
		t.Logf("Error: %v", err)
	} else {
		t.Logf("Success: %s", rule.String())
	}
}
