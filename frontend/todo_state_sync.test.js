const test = require('node:test');
const assert = require('node:assert/strict');

const {
  notifyTodoStateUpdated
} = require('./todo_state_sync');

function createWebContents(name) {
  const sent = [];
  return {
    name,
    sent,
    isDestroyed: () => false,
    send: (channel, payload) => sent.push({ channel, payload })
  };
}

test('notifies other windows when todo state changes', () => {
  const source = createWebContents('widget');
  const main = createWebContents('main');
  const destroyed = {
    isDestroyed: () => true,
    send: () => assert.fail('destroyed webContents should not be notified')
  };
  const state = {
    todoList: [{ id: 'task-1', name: 'report', completed: true }],
    currentTaskId: '',
    todoListDate: '2026-06-30'
  };

  notifyTodoStateUpdated([
    { webContents: source },
    { webContents: main },
    { webContents: destroyed }
  ], source, state);

  assert.deepEqual(source.sent, []);
  assert.deepEqual(main.sent, [
    {
      channel: 'todo-storage:updated',
      payload: state
    }
  ]);
});
