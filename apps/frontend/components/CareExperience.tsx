import Image from "next/image";
import Link from "next/link";
import Icon from "./UiIcon";

const CONSULTATION_IMAGE = "/media/care-team.webp";

const RECEPTION_IMAGE =
  "https://images.pexels.com/photos/4269274/pexels-photo-4269274.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1000&h=1200&dpr=1";

const CARE_MOMENTS = [
  {
    number: "01",
    title: "Trước cuộc hẹn",
    description: "Tìm đúng chuyên khoa, xem hồ sơ bác sĩ và chọn khung giờ thuận tiện.",
  },
  {
    number: "02",
    title: "Khi đến thăm khám",
    description: "Kiểm tra cơ sở, thông tin liên hệ và những điều cần chuẩn bị trước khi đến.",
  },
  {
    number: "03",
    title: "Sau buổi khám",
    description: "Tra cứu lại lịch hẹn và theo dõi những hướng dẫn cần thiết cho lần chăm sóc tiếp theo.",
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

          <figure className="care-experience__secondary-photo">
            <Image
              alt="Nhân viên y tế tại khu vực tiếp đón"
              className="care-experience__image"
              fill
              sizes="(max-width: 640px) 44vw, 18vw"
              src={RECEPTION_IMAGE}
            />
          </figure>

          <div className="care-experience__badge">
            <span><Icon name="heart" size={20} /></span>
            <p><strong>Lắng nghe trước</strong><small>để mỗi lựa chọn rõ ràng hơn</small></p>
          </div>

          <div className="care-experience__signal" aria-hidden="true">
            <span />
            <span />
            <span />
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
