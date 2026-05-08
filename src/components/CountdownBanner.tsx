import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

// Dates estimatives des élections 2027 
// 1er tour : 11 avril 2027. 2nd tour : 25 avril 2027.
// Heures de Paris (CEST = UTC+2 en avril)
// 08h00 CEST = 06h00 UTC, 20h00 CEST = 18h00 UTC
const ROUND_1_START = new Date('2027-04-11T06:00:00Z').getTime();
const ROUND_1_END = new Date('2027-04-11T18:00:00Z').getTime();
const ROUND_2_START = new Date('2027-04-25T06:00:00Z').getTime();
const ROUND_2_END = new Date('2027-04-25T18:00:00Z').getTime();

export function CountdownBanner() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getDaysLeft = (target: number) => {
    const diff = target - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const formatHMS = (target: number) => {
    const ms = target - now;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  let text = '';
  if (now < ROUND_1_START) {
    text = `J-${getDaysLeft(ROUND_1_START)} avant le 1er tour`;
  } else if (now < ROUND_1_END) {
    text = `${formatHMS(ROUND_1_END)} avant résultats`;
  } else if (now < ROUND_2_START) {
    text = `J-${getDaysLeft(ROUND_2_START)} avant le 2nd tour`;
  } else if (now < ROUND_2_END) {
    text = `${formatHMS(ROUND_2_END)} avant résultats finaux`;
  } else {
    text = "Élections terminées";
  }

  return (
    <div 
      className="bg-[#102a5c] text-white flex items-center justify-center gap-1.5 sm:gap-2 pt-1 pb-1.5 px-3 sm:pt-1.5 sm:pb-2 sm:px-4 rounded-br-2xl shadow-sm text-[10px] sm:text-xs font-medium w-max opacity-95 transition-opacity hover:opacity-100"
      aria-live="polite"
    >
      <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white/80 shrink-0" />
      <span className="tracking-wide tracking-[0.01em]">{text}</span>
    </div>
  );
}
