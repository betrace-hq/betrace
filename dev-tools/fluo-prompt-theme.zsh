# FLUO Custom ZSH Prompt Theme
# Displays: directory, git branch, test stats, and prompt symbol

# Enable command substitution in prompt
setopt PROMPT_SUBST

# Color definitions
autoload -U colors && colors

# Git info function
fluo_git_info() {
  local branch
  branch=$(git symbolic-ref --short HEAD 2>/dev/null)
  if [ -n "$branch" ]; then
    # Check for uncommitted changes
    if git diff-index --quiet HEAD -- 2>/dev/null; then
      echo "%{$fg[green]%} $branch%{$reset_color%}"
    else
      echo "%{$fg[yellow]%} $branch*%{$reset_color%}"
    fi
  fi
}

# Test stats function
fluo_test_stats() {
  local stats
  stats=$($HOME/.fluo-dev/prompt-stats.sh 2>/dev/null)
  if [ -n "$stats" ]; then
    echo " %{$fg[cyan]%}$stats%{$reset_color%}"
  fi
}

# Build the prompt
PROMPT='%{$fg[blue]%}%~%{$reset_color%}$(fluo_git_info)$(fluo_test_stats)
%{$fg[magenta]%}➜%{$reset_color%} '

# Right prompt with timestamp (optional)
RPROMPT='%{$fg[240]%}%*%{$reset_color%}'
