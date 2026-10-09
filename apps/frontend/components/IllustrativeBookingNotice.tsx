import { ILLUSTRATIVE_BOOKING_NOTICE } from "../lib/catalogue-illustration";
import { useRef } from "react";
import useDialogFocus from "./useDialogFocus";

export default function IllustrativeBookingNotice({ onClose, modal = true }: { onClose: () => void; modal?: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, modal, onClose);
  const content = <section className="resource-panel bg-white p-6" aria-labelledby="illustrative-booking-title">
    <h2 id="illustrative-booking-title">Thông tin minh họa</h2>
    <p role="status">{ILLUSTRATIVE_BOOKING_NOTICE}</p>
    {modal ? <button className="button mt-4" onClick={onClose} type="button">Đóng cửa sổ đặt lịch</button> : <a className="button mt-4" href="/dat-lich">Chọn thông tin thực tế</a>}
  </section>;
  return modal ? <div ref={dialogRef} className="dialog-layer" role="dialog" aria-modal="true" aria-labelledby="illustrative-booking-title">{content}</div> : content;
}
