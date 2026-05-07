#!/bin/bash

# Start a new tmux session named "claude-demo" in control mode
tmux -CC new-session -d -s claude-demo

# Send the "claude" command to the session
tmux send-keys -t claude-demo "claude --dangerously-skip-permissions" C-m

# Attach to the session in control mode
tmux -CC attach-session -t claude-demo

