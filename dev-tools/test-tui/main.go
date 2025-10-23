package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

const (
	testResultDir = "/tmp/betrace-test-results"
	reportsDir    = testResultDir + "/reports"
	coverageDir   = testResultDir + "/coverage"
)

var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("212")).
			BorderStyle(lipgloss.DoubleBorder()).
			BorderForeground(lipgloss.Color("212")).
			Padding(1, 2).
			Width(80).
			Align(lipgloss.Center)

	successStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("10"))
	failStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("9"))
	warnStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("11"))
	mutedStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("8"))
	boldStyle    = lipgloss.NewStyle().Bold(true)
)

type TestResults struct {
	Frontend struct {
		Total   int `json:"total"`
		Passed  int `json:"passed"`
		Failed  int `json:"failed"`
		Skipped int `json:"skipped"`
	} `json:"frontend"`
	Backend struct {
		Total   int `json:"total"`
		Passed  int `json:"passed"`
		Failed  int `json:"failed"`
		Skipped int `json:"skipped"`
	} `json:"backend"`
	Overall struct {
		Total   int `json:"total"`
		Passed  int `json:"passed"`
		Failed  int `json:"failed"`
		Skipped int `json:"skipped"`
	} `json:"overall"`
}

type CoverageResults struct {
	Overall struct {
		Instruction float64 `json:"instruction"`
		Branch      float64 `json:"branch"`
	} `json:"overall"`
}

type menuItem struct {
	title string
	desc  string
	key   string
}

func (i menuItem) Title() string       { return i.title }
func (i menuItem) Description() string { return i.desc }
func (i menuItem) FilterValue() string { return i.title }

type model struct {
	list        list.Model
	results     *TestResults
	coverage    *CoverageResults
	spinner     spinner.Model
	running     bool
	message     string
	lastRefresh time.Time
	quitting    bool
	width       int
	height      int
	runningCmd  *exec.Cmd
}

type testCompleteMsg struct{}
type refreshMsg struct{}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func loadTestResults() *TestResults {
	data, err := os.ReadFile(filepath.Join(reportsDir, "summary.json"))
	if err != nil {
		return nil
	}

	var results TestResults
	if err := json.Unmarshal(data, &results); err != nil {
		return nil
	}
	return &results
}

func loadCoverage() *CoverageResults {
	data, err := os.ReadFile(filepath.Join(coverageDir, "summary.json"))
	if err != nil {
		return nil
	}

	var coverage CoverageResults
	if err := json.Unmarshal(data, &coverage); err != nil {
		return nil
	}
	return &coverage
}

type cmdStartMsg struct {
	cmd *exec.Cmd
}

func runCommand(args ...string) tea.Cmd {
	return func() tea.Msg {
		cmd := exec.Command(args[0], args[1:]...)
		cmd.Dir = "/Users/sscoble/Projects/betrace"

		// Redirect output to log files to avoid corrupting the TUI
		// The test results will be read from JSON files anyway
		logFile := filepath.Join(testResultDir, "test-run.log")
		os.MkdirAll(testResultDir, 0755)
		if f, err := os.Create(logFile); err == nil {
			cmd.Stdout = f
			cmd.Stderr = f
		}

		// Send the cmd before starting so we can track it
		return cmdStartMsg{cmd: cmd}
	}
}

func executeCmd(cmd *exec.Cmd) tea.Cmd {
	return func() tea.Msg {
		_ = cmd.Run()
		return testCompleteMsg{}
	}
}

func tickRefresh() tea.Cmd {
	return tea.Tick(time.Second*2, func(t time.Time) tea.Msg {
		return refreshMsg{}
	})
}

func initialModel() model {
	items := []list.Item{
		menuItem{"🚀 Run All Tests", "Execute full test suite (frontend + backend)", "a"},
		menuItem{"🎯 Run Frontend Tests", "Run Vitest tests only", "f"},
		menuItem{"☕ Run Backend Tests", "Run JUnit/Maven tests only", "b"},
		menuItem{"🔄 Watch Mode", "Continuous testing on file changes", "w"},
		menuItem{"📊 Coverage Report", "Open HTML coverage in browser", "c"},
		menuItem{"📈 Coverage Trend", "View historical coverage data", "t"},
		menuItem{"🔍 Failed Tests", "View details of failed tests", "d"},
		menuItem{"🧹 Clear Cache", "Remove all test results and history", "x"},
		menuItem{"🔄 Refresh", "Reload test results from disk", "r"},
		menuItem{"❌ Exit", "Quit the test dashboard", "q"},
	}

	l := list.New(items, list.NewDefaultDelegate(), 80, 14)
	l.Title = "Test Operations"
	l.SetShowStatusBar(false)
	l.SetFilteringEnabled(false)
	l.SetShowHelp(false)
	l.Styles.Title = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("99")).
		MarginLeft(2)
	// Remove default border to prevent overlap
	l.Styles.TitleBar = lipgloss.NewStyle()
	l.Styles.PaginationStyle = lipgloss.NewStyle().PaddingLeft(2)

	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	return model{
		list:        l,
		spinner:     s,
		results:     loadTestResults(),
		coverage:    loadCoverage(),
		lastRefresh: time.Now(),
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		tickRefresh(),
	)
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" {
			// If a test is running, kill it but stay in TUI
			if m.running && m.runningCmd != nil && m.runningCmd.Process != nil {
				_ = m.runningCmd.Process.Kill()
				m.running = false
				m.runningCmd = nil
				m.message = "⚠️  Test cancelled"
				return m, tea.Tick(time.Second*2, func(t time.Time) tea.Msg {
					return refreshMsg{}
				})
			}
			// If no test is running, quit the TUI
			m.quitting = true
			return m, tea.Quit
		}

		if m.running {
			return m, nil
		}

		switch msg.String() {
		case "q":
			m.quitting = true
			return m, tea.Quit

		case "enter":
			item, ok := m.list.SelectedItem().(menuItem)
			if !ok {
				return m, nil
			}

			switch item.key {
			case "a": // Run all tests
				m.running = true
				m.message = "Running all tests..."
				return m, tea.Batch(
					m.spinner.Tick,
					runCommand("nix", "run", ".#test"),
				)

			case "f": // Frontend tests
				m.running = true
				m.message = "Running frontend tests..."
				return m, tea.Batch(
					m.spinner.Tick,
					runCommand("bash", "-c", "cd bff && npm run test -- --run"),
				)

			case "b": // Backend tests
				m.running = true
				m.message = "Running backend tests..."
				return m, tea.Batch(
					m.spinner.Tick,
					runCommand("bash", "-c", "cd backend && mvn test"),
				)

			case "w": // Watch mode
				// Write a flag file to signal the wrapper to start watch mode
				flagFile := filepath.Join(testResultDir, ".watch-mode-requested")
				os.MkdirAll(testResultDir, 0755)
				os.WriteFile(flagFile, []byte("1"), 0644)
				m.quitting = true
				return m, tea.Quit

			case "c": // Coverage report
				_ = exec.Command("open", "http://localhost:12099").Start()
				m.message = "Opening coverage report in browser..."
				return m, tea.Tick(time.Second*2, func(t time.Time) tea.Msg {
					return refreshMsg{}
				})

			case "t": // Coverage trend
				// TODO: Show trend in pager
				m.message = "Coverage trend view coming soon..."
				return m, tea.Tick(time.Second*2, func(t time.Time) tea.Msg {
					return refreshMsg{}
				})

			case "d": // Failed tests
				// TODO: Show failed tests in pager
				m.message = "Failed test details coming soon..."
				return m, tea.Tick(time.Second*2, func(t time.Time) tea.Msg {
					return refreshMsg{}
				})

			case "x": // Clear cache
				os.RemoveAll(testResultDir)
				m.results = nil
				m.coverage = nil
				m.message = "✓ Cache cleared!"
				return m, tea.Tick(time.Second*2, func(t time.Time) tea.Msg {
					return refreshMsg{}
				})

			case "r": // Refresh
				m.results = loadTestResults()
				m.coverage = loadCoverage()
				m.lastRefresh = time.Now()
				m.message = "✓ Refreshed!"
				return m, tea.Tick(time.Second*2, func(t time.Time) tea.Msg {
					return refreshMsg{}
				})

			case "q": // Quit
				m.quitting = true
				return m, tea.Quit
			}
		}

	case cmdStartMsg:
		// Store the command and start executing it
		m.runningCmd = msg.cmd
		return m, executeCmd(msg.cmd)

	case testCompleteMsg:
		m.running = false
		m.runningCmd = nil
		m.message = "✓ Tests completed!"
		m.results = loadTestResults()
		m.coverage = loadCoverage()
		m.lastRefresh = time.Now()
		return m, tea.Tick(time.Second*2, func(t time.Time) tea.Msg {
			return refreshMsg{}
		})

	case refreshMsg:
		if time.Since(m.lastRefresh) > time.Second*10 {
			m.results = loadTestResults()
			m.coverage = loadCoverage()
			m.lastRefresh = time.Now()
		}
		m.message = ""
		return m, tickRefresh()

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.list.SetWidth(msg.Width)
		// Reserve space for header, results, coverage, footer (approx 20 lines)
		listHeight := max(msg.Height-22, 8)
		m.list.SetHeight(listHeight)
		return m, nil
	}

	var cmd tea.Cmd
	m.list, cmd = m.list.Update(msg)
	return m, cmd
}

func (m model) View() string {
	if m.quitting {
		return mutedStyle.Render("Thanks for testing with BeTrace! 👋\n")
	}

	var s strings.Builder

	// Header
	s.WriteString(titleStyle.Render("🧪 BeTrace Interactive Test Dashboard\nYour command center for testing"))
	s.WriteString("\n\n")

	// Test Results Summary
	if m.results != nil {
		s.WriteString(boldStyle.Render("📊 Test Results Summary"))
		s.WriteString("\n\n")

		// Frontend
		if m.results.Frontend.Total > 0 {
			pct := float64(m.results.Frontend.Passed) / float64(m.results.Frontend.Total) * 100
			status := fmt.Sprintf("Frontend: %d/%d (%.0f%%)", m.results.Frontend.Passed, m.results.Frontend.Total, pct)
			if m.results.Frontend.Failed == 0 {
				s.WriteString(successStyle.Render("  ✓ " + status))
			} else {
				s.WriteString(failStyle.Render(fmt.Sprintf("  ✗ %s - %d failed", status, m.results.Frontend.Failed)))
			}
		} else {
			s.WriteString(mutedStyle.Render("  - Frontend: No tests"))
		}
		s.WriteString("\n")

		// Backend
		if m.results.Backend.Total > 0 {
			pct := float64(m.results.Backend.Passed) / float64(m.results.Backend.Total) * 100
			status := fmt.Sprintf("Backend:  %d/%d (%.0f%%)", m.results.Backend.Passed, m.results.Backend.Total, pct)
			if m.results.Backend.Failed == 0 {
				s.WriteString(successStyle.Render("  ✓ " + status))
			} else {
				s.WriteString(failStyle.Render(fmt.Sprintf("  ✗ %s - %d failed", status, m.results.Backend.Failed)))
			}
		} else {
			s.WriteString(mutedStyle.Render("  - Backend:  No tests"))
		}
		s.WriteString("\n\n")

		// Overall
		if m.results.Overall.Total > 0 {
			pct := float64(m.results.Overall.Passed) / float64(m.results.Overall.Total) * 100
			s.WriteString(boldStyle.Render(fmt.Sprintf("  Overall: %d/%d (%.0f%%)", m.results.Overall.Passed, m.results.Overall.Total, pct)))
		}
		s.WriteString("\n")
	} else {
		s.WriteString(mutedStyle.Render("No test results yet. Run tests to see results."))
		s.WriteString("\n")
	}

	// Coverage
	if m.coverage != nil {
		s.WriteString("\n")
		s.WriteString(boldStyle.Render("📈 Coverage"))
		s.WriteString("\n\n")

		// Instruction
		instStyle := successStyle
		if m.coverage.Overall.Instruction < 90 {
			if m.coverage.Overall.Instruction < 80 {
				instStyle = failStyle
			} else {
				instStyle = warnStyle
			}
		}
		s.WriteString(instStyle.Render(fmt.Sprintf("  Instruction: %.1f%% (target: 90%%)", m.coverage.Overall.Instruction)))
		s.WriteString("\n")

		// Branch
		branchStyle := successStyle
		if m.coverage.Overall.Branch < 80 {
			if m.coverage.Overall.Branch < 70 {
				branchStyle = failStyle
			} else {
				branchStyle = warnStyle
			}
		}
		s.WriteString(branchStyle.Render(fmt.Sprintf("  Branch:      %.1f%% (target: 80%%)", m.coverage.Overall.Branch)))
		s.WriteString("\n")
	}

	s.WriteString("\n")

	// Running indicator or menu
	if m.running {
		s.WriteString(fmt.Sprintf("\n%s %s\n\n", m.spinner.View(), m.message))
	} else {
		if m.message != "" {
			s.WriteString(successStyle.Render(m.message))
			s.WriteString("\n\n")
		}
		s.WriteString(m.list.View())
	}

	s.WriteString("\n")
	s.WriteString(mutedStyle.Render(fmt.Sprintf("  Last refresh: %s", m.lastRefresh.Format("15:04:05"))))

	// Show different help text based on state
	if m.running {
		s.WriteString(mutedStyle.Render("  │  Press ctrl+c to cancel"))
	} else {
		s.WriteString(mutedStyle.Render("  │  Press q or ctrl+c to quit"))
	}

	return s.String()
}

func main() {
	p := tea.NewProgram(initialModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error: %v", err)
		os.Exit(1)
	}
}
