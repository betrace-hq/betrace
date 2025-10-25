package dsl

import "testing"

func TestDebugLexer(t *testing.T) {
	input := "when { trace.has(test) }"
	l := NewLexer(input)
	
	for {
		tok := l.NextToken()
		t.Logf("%s: %q", tok.Type, tok.Literal)
		if tok.Type == EOF {
			break
		}
	}
}
