"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Icon, { type IconName } from "./UiIcon";

const TIPS: Array<{ icon: IconName; tag: string; title: string; text: string }> = [
  { icon: "heart", tag: "Tim mạch", title: "Đi bộ 30 phút mỗi ngày", text: "Một quãng đường nhẹ mỗi ngày giúp tim khỏe hơn và huyết áp ổn định hơn. Bắt đầu chậm và đều đặn nhé." },
  { icon: "activity", tag: "Tiêu hóa", title: "Uống đủ 1.5–2 lít nước", text: "Uống nước đều trong ngày giúp tiêu hóa làm việc nhẹ nhàng hơn. Hạn chế nước đá ngay sau bữa ăn." },
  { icon: "user", tag: "Sức khỏe gia đình", title: "Khám tổng quát định kỳ mỗi năm", text: "Nhiều bệnh phát hiện sớm sẽ điều trị đơn giản và nhẹ nhàng hơn rất nhiều. Đặt lịch trước 1–2 tuần để chọn khung giờ đẹp." },
  { icon: "brain", tag: "Tinh thần", title: "Ngủ đủ 7–8 tiếng", text: "Đi ngủ và thức dậy cùng một khung giờ giúp tinh thần tỉnh táo và trái tim bình yên hơn." },
  { icon: "layers", tag: "Xương khớp", title: "Vươn vai mỗi 45 phút ngồi", text: "Nếu làm việc tại bàn, hãy đứng lên vươn vai nhẹ nhàng. Cột sống và vai gáy sẽ cảm ơn bạn." },
  { icon: "sparkles", tag: "Dinh dưỡng", title: "Đĩa ăn đủ màu", text: "Rau củ nhiều màu sắc trong bữa ăn là cách đơn giản nhất để bổ sung vitamin tự nhiên mỗi ngày." },
  { icon: "shield-check", tag: "Phòng bệnh", title: "Rửa tay đúng cách 20 giây", text: "Rửa tay bằng xà phòng là bảo vệ đơn giản nhất cho bạn và cả gia đình trước mùa dịch." },
];

const AUTO_ADVANCE_MS = 9000;

// Server (UTC) and browser (local) clocks can disagree on the day, so a
// render-time day seed would hydrate mismatched tip text. The tip index is
// derived instead: 0 for SSR and the hydration pass, then day-seeded once the
// store reports a mounted client.
const emptySubscribe = () => () => {};

function getMountedSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * "Mẹo sức khỏe mỗi ngày" — a rotating, zero-backend wellness tip card.
 * The first tip is seeded by the day of year so the card feels fresh daily.
 * Auto-advances gently, pauses on hover/focus, and collapses all motion under
 * prefers-reduced-motion (the reveal observer also bails on reduce).
 */
export default function DailyHealthTip() {
  const mounted = useSyncExternalStore(emptySubscribe, getMountedSnapshot, getServerSnapshot);
  const [rotation, setRotation] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reveal, setReveal] = useState<"idle" | "pre" | "in">("idle");
  const rootRef = useRef<HTMLElement | null>(null);

  const dayIndex = useMemo(() => {
    if (!mounted) return 0;
    const now = new Date();
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
    );
    return dayOfYear % TIPS.length;
  }, [mounted]);
  const index = mounted ? (dayIndex + rotation) % TIPS.length : 0;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window) || !rootRef.current) return;
    setReveal("pre");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setReveal("in");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(
      () => setRotation((v) => (v + 1) % TIPS.length),
      AUTO_ADVANCE_MS,
    );
    return () => window.clearInterval(timer);
  }, [paused]);

  const tip = TIPS[index];

  return (
    <section
      ref={rootRef}
      aria-labelledby="daily-tip-title"
      className="daily-tip"
      data-reveal={reveal}
      onBlur={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span aria-hidden="true" className="daily-tip__icon">
        <Icon name={tip.icon} size={26} />
      </span>
      <div className="daily-tip__body">
        <p className="daily-tip__kicker">
          <span aria-hidden="true" className="daily-tip__pulse" />
          Mẹo sức khỏe mỗi ngày
          <span className="daily-tip__tag">{tip.tag}</span>
        </p>
        {/* key remount retriggers the swap animation on every rotation */}
        <div aria-live="polite" className="daily-tip__content" key={index}>
          <h2 id="daily-tip-title">{tip.title}</h2>
          <p>{tip.text}</p>
        </div>
        <div className="daily-tip__actions">
          <button
            className="text-button daily-tip__next"
            onClick={() => setRotation((v) => (v + 1) % TIPS.length)}
            type="button"
          >
            Mẹo khác <Icon name="arrow-right" size={16} />
          </button>
          <span aria-hidden="true" className="daily-tip__dots">
            {TIPS.map((item, dotIndex) => (
              <i
                key={item.tag}
                className={
                  dotIndex === index ? "daily-tip__dot daily-tip__dot--on" : "daily-tip__dot"
                }
              />
            ))}
          </span>
        </div>
      </div>
    </section>
  );
}
