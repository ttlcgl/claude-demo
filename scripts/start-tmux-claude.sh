#!/bin/bash

# Start a new tmux session named "claude-demo"
tmux new-session -d -s claude-demo

# Send the "claude" command to the session
tmux send-keys -t claude-demo "claude" C-m

# Attach to the session
tmux attach-session -t claude-demo

