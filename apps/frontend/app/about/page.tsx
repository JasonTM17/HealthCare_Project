"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import Icon from "../../components/UiIcon";
import { fetchBranches, fetchDoctors, fetchSpecialties } from "../../lib/api-client";
import styles from "./about.module.css";

type Snapshot = { doctors: number; specialties: number; branches: number };

const VALUES = [
  {
    icon: "heart" as const,
    title: "Tôn trọng",
    description:
      "Lắng nghe nhu cầu và hoàn cảnh riêng của mỗi người bệnh trước khi đề xuất bước chăm sóc tiếp theo.",
  },
  {
    icon: "shield-check" as const,
    title: "Trách nhiệm",
    description:
      "Thông tin về bác sĩ, cơ sở, thời gian khám và lịch hẹn được trình bày rõ ràng, dễ kiểm tra.",
  },
  {
    icon: "stethoscope" as const,
    title: "Phù hợp",
    description:
      "Giúp người bệnh kết nối đúng chuyên khoa và đúng đội ngũ chuyên môn từ bước đầu tiên.",
  },
  {
    icon: "layers" as const,
    title: "Liền mạch",
    description:
      "Kết nối hành trình từ tìm hiểu, đặt lịch đến tra cứu và theo dõi hướng dẫn sau thăm khám.",
  },
];

const JOURNEY = [
  {
    label: "Trước khi đến viện",
    title: "Hiểu rõ lựa chọn",
    description: "Tìm chuyên khoa, bác sĩ, gói khám và cơ sở phù hợp trên cùng một hệ thống.",
  },
  {
    label: "Trong ngày thăm khám",
    title: "Chủ động thời gian",
    description: "Đặt trước lịch khám và lưu lại đầy đủ thông tin cần thiết cho cuộc hẹn.",
  },
  {
    label: "Sau khi thăm khám",
    title: "Tiếp tục đồng hành",
    description: "Tra cứu lịch sử cuộc hẹn và theo dõi hướng dẫn chăm sóc trong hồ sơ cá nhân.",
  },
];

export default function AboutPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      try {
        const [doctors, specialties, branches] = await Promise.all([
          fetchDoctors({ page: 0, size: 1 }),
          fetchSpecialties(0, 1),
          fetchBranches(0, 1),
        ]);
        if (!cancelled) {
          setSnapshot({
            doctors: doctors.totalElements,
            specialties: specialties.totalElements,
            branches: branches.totalElements,
          });
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      void task;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      if (motionPreference.matches) {
        video.pause();
        video.currentTime = 0;
        return;
      }
      void video.play().catch(() => undefined);
    };

    syncPlayback();
    motionPreference.addEventListener("change", syncPlayback);
    return () => motionPreference.removeEventListener("change", syncPlayback);
  }, []);

  return (
    <PublicPageShell>
      <div className={styles.page}>
        <section className={`${styles.hero} section-inner`} aria-labelledby="about-title">
          <div className={styles.heroCopy}>
            <p className="section-note">Về HealthCare</p>
            <h1 id="about-title">Chăm sóc bắt đầu từ sự thấu hiểu</h1>
            <p className={styles.heroLead}>
              Chúng tôi kết nối con người, chuyên môn và công nghệ để mỗi người bệnh
              biết mình nên bắt đầu từ đâu và luôn chủ động trong hành trình chăm sóc sức khỏe.
            </p>
            <div className="resource-actions">
              <PublicBookingButton className="button button--primary">Đặt lịch khám</PublicBookingButton>
              <Link className="outline-button" href="/branches">Xem cơ sở gần bạn</Link>
            </div>
            <ul className={styles.heroPromises} aria-label="Cam kết chăm sóc">
              <li><Icon name="check" size={17} /> Thông tin rõ ràng</li>
              <li><Icon name="check" size={17} /> Lựa chọn phù hợp</li>
              <li><Icon name="check" size={17} /> Đồng hành liền mạch</li>
            </ul>
          </div>

          <figure className={styles.teamShowcase}>
            <Image
              src="/media/hospital-team-landscape.jpg"
              alt="Đội ngũ bác sĩ và nhân viên y tế chuyên khoa Bệnh viện HealthCare"
              width={1024}
              height={682}
              priority
              className={styles.teamImage}
            />
            <figcaption className={styles.teamCaption}>
              Đội ngũ chuyên gia y tế, bác sĩ chuyên khoa và điều dưỡng tận tâm tại HealthCare luôn sẵn sàng đồng hành cùng bạn.
            </figcaption>
          </figure>
        </section>

        <section className={`${styles.story} section-inner`} aria-labelledby="about-story-title">
          <div className={styles.storyHeading}>
            <p className="section-note">Câu chuyện của chúng tôi</p>
            <h2 id="about-story-title">Bệnh viện dễ tiếp cận hơn, từ những điều rất nhỏ</h2>
          </div>
          <div className={styles.storyBody}>
            <p className={styles.storyLead}>
              Một hành trình khám bệnh tốt không chỉ bắt đầu trong phòng khám. Nó bắt đầu từ lúc
              người bệnh được giải thích rõ, chọn đúng nơi và biết điều gì sẽ diễn ra tiếp theo.
            </p>
            <p>
              HealthCare được xây dựng để thu hẹp khoảng cách đó. Thông tin chuyên khoa, đội ngũ
              bác sĩ, cơ sở và lịch khám được đặt trong một trải nghiệm thống nhất, giúp người bệnh
              bớt lo lắng và dành nhiều thời gian hơn cho điều quan trọng nhất: sức khỏe của mình.
            </p>
            <blockquote>
              “Mỗi điểm chạm đều cần mang lại cảm giác được lắng nghe, được hướng dẫn và được tôn trọng.”
            </blockquote>
            <figure className={styles.videoFigure}>
              <div className={styles.videoFrame}>
                <video
                  ref={videoRef}
                  aria-label="Thước phim minh họa hành trình tư vấn và chăm sóc người bệnh"
                  autoPlay
                  disablePictureInPicture
                  loop
                  muted
                  onContextMenu={(event) => event.preventDefault()}
                  playsInline
                  poster="/media/about-care-poster.jpg"
                  preload="metadata"
                >
                  <source src="/media/about-introduction.mp4" type="video/mp4" />
                  Trình duyệt của bạn chưa hỗ trợ phát video. Bạn vẫn có thể tìm hiểu về HealthCare qua nội dung bên dưới.
                </video>
                <div className={styles.videoLabel}>
                  <span className={styles.videoPulse} aria-hidden="true" />
                  Thước phim giới thiệu
                </div>
              </div>
              <figcaption>
                Thước phim minh họa hành trình tư vấn. Nguồn:{" "}
                <a href="https://www.pexels.com/video/woman-getting-medical-consultation-4486776/" rel="noreferrer" target="_blank">
                  Cedric Fauntleroy / Pexels
                </a>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className={styles.valuesSection} aria-labelledby="about-values-title">
          <div className="section-inner">
            <div className={styles.sectionHeading}>
              <div>
                <p className="section-note">Nguyên tắc chăm sóc</p>
                <h2 id="about-values-title">Bốn điều dẫn lối cho mọi trải nghiệm</h2>
              </div>
              <p>
                Không phải những khẩu hiệu xa vời, đây là cách chúng tôi thiết kế từng bước
                người bệnh tương tác với bệnh viện.
              </p>
            </div>
            <div className={styles.valueGrid}>
              {VALUES.map((value, index) => (
                <article className={styles.valueCard} key={value.title}>
                  <span className={styles.valueIndex}>0{index + 1}</span>
                  <span className={styles.valueIcon}><Icon name={value.icon} size={25} /></span>
                  <h3>{value.title}</h3>
                  <p>{value.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.network} section-inner`} aria-labelledby="about-network-title">
          <div className={styles.networkPanel}>
            <div className={styles.networkCopy}>
              <p className="section-note">Mạng lưới HealthCare</p>
              <h2 id="about-network-title">Một điểm kết nối, nhiều lựa chọn chăm sóc</h2>
              <p>
                Khám phá đội ngũ chuyên môn và các cơ sở đang tiếp nhận đặt lịch trong hệ thống.
              </p>
              <Link className={styles.networkLink} href="/branches">
                Tìm cơ sở và chỉ đường <Icon name="arrow-up-right" size={18} />
              </Link>
            </div>

            {loading ? (
              <p className={styles.networkStatus} role="status">Đang cập nhật quy mô mạng lưới…</p>
            ) : null}
            {error ? (
              <p className={styles.networkStatus} role="status">
                Quy mô mạng lưới đang được cập nhật. Bạn vẫn có thể xem từng cơ sở từ liên kết bên cạnh.
              </p>
            ) : null}
            {snapshot ? (
              <dl className={styles.metrics} aria-label="Quy mô mạng lưới hiện tại">
                {[
                  ["Bác sĩ", snapshot.doctors],
                  ["Chuyên khoa", snapshot.specialties],
                  ["Cơ sở", snapshot.branches],
                ].map(([label, count]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{count}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </section>

        <section className={`${styles.journey} section-inner`} aria-labelledby="about-journey-title">
          <div className={styles.journeyIntro}>
            <p className="section-note">Hành trình người bệnh</p>
            <h2 id="about-journey-title">Đồng hành trước, trong và sau cuộc hẹn</h2>
            <p>Mỗi bước được sắp xếp để bạn dễ hiểu, dễ thực hiện và không bỏ lỡ thông tin quan trọng.</p>
          </div>
          <ol className={styles.journeyList}>
            {JOURNEY.map((item, index) => (
              <li key={item.title}>
                <span className={styles.journeyNumber}>{index + 1}</span>
                <div>
                  <p>{item.label}</p>
                  <h3>{item.title}</h3>
                  <span>{item.description}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${styles.closing} section-inner`} aria-labelledby="about-closing-title">
          <div>
            <p className="section-note">Bắt đầu cùng HealthCare</p>
            <h2 id="about-closing-title">Chúng tôi sẵn sàng lắng nghe bạn</h2>
            <p>Chọn chuyên khoa phù hợp hoặc liên hệ bệnh viện nếu bạn cần được hướng dẫn thêm.</p>
          </div>
          <div className="resource-actions">
            <Link className="button button--primary" href="/specialties">Xem chuyên khoa</Link>
            <Link className="outline-button" href="/contact">Liên hệ bệnh viện</Link>
          </div>
        </section>

        <p className={`${styles.referenceNote} section-inner`}>
          Tham khảo từ một trang web bệnh viện công khai.
        </p>
      </div>
    </PublicPageShell>
  );
}
