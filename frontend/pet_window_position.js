function centerBoundsInWorkArea(size, workArea) {
  const width = Math.round(size.width);
  const height = Math.round(size.height);
  const centeredX = Math.round(workArea.x + (workArea.width - width) / 2);
  const centeredY = Math.round(workArea.y + (workArea.height - height) / 2);
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;

  return {
    x: Math.min(Math.max(workArea.x, centeredX), Math.max(workArea.x, maxX)),
    y: Math.min(Math.max(workArea.y, centeredY), Math.max(workArea.y, maxY)),
    width,
    height
  };
}

module.exports = {
  centerBoundsInWorkArea
};
