import React, { FC, useRef } from 'react';

const LuckyWheel: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = ["#FF5733", "#33FF57", "#3357FF", "#F0FF33", "#FF33F0"];
    const slices = 5;
    const radius = canvas.width / 2;
    const center = { x: radius, y: radius };

    for (let i = 0; i < slices; i++) {
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.arc(center.x, center.y, radius, (i * 2 * Math.PI) / slices, ((i + 1) * 2 * Math.PI) / slices);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.stroke();
    }
  }, []);

  return <canvas ref={canvasRef} width={400} height={400} />;
};

export default LuckyWheel;