import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getPackageVisual } from "../lib/package-visuals";
import type { HealthPackage } from "../types/hospital";
import Icon from "./UiIcon";
import styles from "./PackageVisuals.module.css";

const formatCurrency = (price: number): string => new Intl.NumberFormat("vi-VN").format(price);

interface PackageVisualCardProps {
  packageItem: HealthPackage;
  bookingAction: ReactNode;
  headingLevel?: "h2" | "h3";
  priority?: boolean;
  variant?: "catalog" | "home";
}

export default function PackageVisualCard({
  packageItem,
  bookingAction,
  headingLevel = "h3",
  priority = false,
  variant = "catalog",
}: PackageVisualCardProps) {
  const visual = getPackageVisual(packageItem);
  const Heading = headingLevel;
  const detailHref = `/packages/${packageItem.slug}`;
  const checklist = packageItem.checklist?.slice(0, variant === "home" ? 2 : 3) ?? [];

  return (
    <article className={`${styles.card} ${styles[`tone-${visual.tone}`]} ${variant === "home" ? styles.cardHome : ""}`}>
      <Link className={styles.mediaLink} href={detailHref} aria-label={`Xem chi tiết ${packageItem.name}`}>
        <figure className={styles.media}>
          <Image
            alt={visual.imageAlt}
            className={styles.image}
            fill
            priority={priority}
            sizes={variant === "home" ? "(max-width: 640px) 82vw, (max-width: 1050px) 46vw, 25vw" : "(max-width: 760px) 100vw, 46vw"}
            src={visual.imageSrc}
          />
          <span className={styles.imageWash} aria-hidden="true" />
          <span className={styles.category}>{visual.category}</span>
          <figcaption className="sr-only">Ảnh minh họa: {visual.sourceLabel}</figcaption>
        </figure>
      </Link>

      <div className={styles.body}>
        <div className={styles.topline}>
          <span className={styles.kicker}>Gói khám sức khỏe</span>
          {packageItem.durationDays ? (
            <span className={styles.duration}><Icon name="clock" size={15} />{packageItem.durationDays} ngày</span>
          ) : null}
        </div>
        <Heading className={styles.title}><Link href={detailHref}>{packageItem.name}</Link></Heading>
        <p className={styles.description}>{packageItem.description || "Thông tin chi tiết của gói khám đang được cập nhật."}</p>

        {packageItem.targetAudience ? (
          <p className={styles.audience}><Icon name="user" size={16} /><span>{packageItem.targetAudience}</span></p>
        ) : null}

        {checklist.length > 0 ? (
          <ul className={styles.checklist} aria-label="Một số nội dung trong gói">
            {checklist.map((entry) => <li key={entry}><Icon name="check" size={15} />{entry}</li>)}
          </ul>
        ) : null}

        <div className={styles.footer}>
          <p className={styles.price}><small>Chi phí gói</small><strong>{formatCurrency(packageItem.price)} <span>VNĐ</span></strong></p>
          <div className={styles.actions}>
            <Link className={styles.detailLink} href={detailHref}>Chi tiết <Icon name="arrow-up-right" size={16} /></Link>
            {bookingAction}
          </div>
        </div>
      </div>
    </article>
  );
}

export { styles as packageVisualStyles };
