package models

// Rule represents a BeTrace DSL rule
type Rule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Severity    string `json:"severity"`    // HIGH, MEDIUM, LOW
	Expression  string `json:"expression"`  // BeTrace DSL syntax
	LuaCode     string `json:"luaCode"`     // Compiled Lua code
	Enabled     bool   `json:"enabled"`
}
