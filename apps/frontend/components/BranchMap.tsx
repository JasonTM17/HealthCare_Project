import Icon from "./UiIcon";

type BranchMapVariant = "embed" | "link";

interface BranchMapProps {
  address?: string | null;
  branchName?: string | null;
  className?: string;
  variant?: BranchMapVariant;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function createGoogleMapsUrls(address: string, branchName?: string, embedKey?: string) {
  const query = encodeURIComponent([branchName?.trim(), address.trim()].filter(Boolean).join(", "));

  return {
    embed: embedKey
      ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(embedKey)}&q=${query}`
      : null,
    open: `https://www.google.com/maps/search/?api=1&query=${query}`,
  };
}

export default function BranchMap({
  address,
  branchName,
  className,
  variant = "embed",
}: BranchMapProps) {
  const normalizedAddress = address?.trim();
  const normalizedName = branchName?.trim();

  if (!normalizedAddress) {
    return variant === "embed" ? (
      <div className={joinClassNames("branch-map branch-map--empty", className)} role="status">
        <span className="branch-map__empty-icon" aria-hidden="true">
          <Icon name="location" size={24} />
        </span>
        <div>
          <strong>Vị trí đang được cập nhật</strong>
          <p>Địa chỉ Google Maps của cơ sở sẽ hiển thị tại đây khi có thông tin.</p>
        </div>
      </div>
    ) : (
      <span className={joinClassNames("branch-map-link branch-map-link--unavailable", className)}>
        <Icon name="location" size={17} />
        Google Maps đang cập nhật
      </span>
    );
  }

  const embedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY?.trim();
  const maps = createGoogleMapsUrls(normalizedAddress, normalizedName, embedKey);
  const mapLabel = normalizedName
    ? `Mở địa chỉ ${normalizedName} trên Google Maps`
    : "Mở địa chỉ trên Google Maps";

  if (variant === "link") {
    return (
      <a
        aria-label={mapLabel}
        className={joinClassNames("branch-map-link", className)}
        href={maps.open}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Icon name="location" size={17} />
        <span>Mở Google Maps</span>
        <Icon className="branch-map-link__arrow" name="arrow-up-right" size={16} />
      </a>
    );
  }

  return (
    <figure className={joinClassNames("branch-map", className)}>
      <div className="branch-map__viewport">
        {maps.embed ? (
          <iframe
            allowFullScreen
            className="branch-map__iframe"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            src={maps.embed}
            title={normalizedName ? `Bản đồ ${normalizedName}` : "Bản đồ cơ sở khám bệnh"}
          />
        ) : (
          <div className="branch-map__placeholder">
            <span aria-hidden="true">
              <Icon name="location" size={34} />
            </span>
            <div>
              <strong>Xem vị trí chính xác trên Google Maps</strong>
              <p>Mở bản đồ để xem đường đi và lựa chọn tuyến đường thuận tiện.</p>
            </div>
            <a aria-label={mapLabel} href={maps.open} rel="noopener noreferrer" target="_blank">
              Mở Google Maps
              <Icon name="arrow-up-right" size={17} />
            </a>
          </div>
        )}
      </div>
      <figcaption className="branch-map__caption">
        <span className="branch-map__marker" aria-hidden="true">
          <Icon name="location" size={20} />
        </span>
        <div className="branch-map__address">
          {normalizedName ? <span>{normalizedName}</span> : null}
          <strong>{normalizedAddress}</strong>
        </div>
        <a aria-label={mapLabel} href={maps.open} rel="noopener noreferrer" target="_blank">
          Mở Google Maps
          <Icon name="arrow-up-right" size={17} />
        </a>
      </figcaption>
    </figure>
  );
}
