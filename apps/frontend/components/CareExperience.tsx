import Image from "next/image";
import Link from "next/link";
import Icon from "./UiIcon";

const CONSULTATION_IMAGE = "/media/care-team.webp";

const CARE_MOMENTS = [
  {
    number: "01",
    title: "Tiếp đón & Hướng dẫn",
    description: "Được hướng dẫn chu đáo giấy tờ cần thiết, thủ tục BHYT và đón tiếp tận tình ngay khi đến viện.",
  },
  {
    number: "02",
    title: "Thăm khám chuyên sâu",
    description: "Bác sĩ lắng nghe kỹ lưỡng, giải thích tường tận kết quả xét nghiệm và thống nhất phác đồ điều trị.",
  },
  {
    number: "03",
    title: "Đồng hành sau khám",
    description: "Dễ dàng tra cứu hồ sơ điện tử, theo dõi đơn thuốc và nhận nhắc nhở chăm sóc sức khỏe định kỳ.",
  },
];

export default function CareExperience(): React.ReactElement {
  return (
    <section className="care-experience" aria-labelledby="care-experience-title">
      <div className="care-experience__inner section-inner">
        <div className="care-experience__visual" data-motion="visual">
          <figure className="care-experience__primary-photo">
            <Image
              alt="Đội ngũ y bác sĩ HealthCare đứng cùng nhau trong sảnh bệnh viện"
              className="care-experience__image"
              fill
              sizes="(max-width: 900px) 92vw, 42vw"
              src={CONSULTATION_IMAGE}
            />
          </figure>

          <div className="care-experience__badge">
            <span><Icon name="heart" size={20} /></span>
            <p><strong>Lắng nghe trước</strong><small>để mỗi lựa chọn rõ ràng hơn</small></p>
          </div>
        </div>

        <div className="care-experience__copy">
          <p className="section-note">Trải nghiệm tại HealthCare</p>
          <h2 id="care-experience-title">Không chỉ là một cuộc hẹn.</h2>
          <p className="care-experience__lead">
            Một hành trình chăm sóc tốt bắt đầu trước khi bạn bước vào phòng khám
            và tiếp tục sau khi cuộc hẹn kết thúc.
          </p>

          <div className="care-experience__moments">
            {CARE_MOMENTS.map((moment) => (
              <article key={moment.number}>
                <span>{moment.number}</span>
                <div>
                  <h3>{moment.title}</h3>
                  <p>{moment.description}</p>
                </div>
                <Icon name="arrow-up-right" size={18} />
              </article>
            ))}
          </div>

          <div className="care-experience__actions">
            <Link className="button button--experience" href="/huong-dan">
              Xem hướng dẫn thăm khám <Icon name="arrow-up-right" size={18} />
            </Link>
            <Link className="text-button text-button--experience" href="/about">
              Về HealthCare <Icon name="arrow-right" size={17} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
