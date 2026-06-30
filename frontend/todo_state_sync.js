const TODO_STATE_UPDATED_CHANNEL = 'todo-storage:updated';

function notifyTodoStateUpdated(windows = [], sourceWebContents, todoState) {
  windows.forEach((targetWindow) => {
    const targetWebContents = targetWindow?.webContents;
    if (
      !targetWebContents ||
      targetWebContents === sourceWebContents ||
      targetWebContents.isDestroyed()
    ) {
      return;
    }

    targetWebContents.send(TODO_STATE_UPDATED_CHANNEL, todoState);
  });
}

module.exports = {
  TODO_STATE_UPDATED_CHANNEL,
  notifyTodoStateUpdated
};
