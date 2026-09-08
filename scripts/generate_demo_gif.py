import os
from PIL import Image, ImageDraw, ImageFont

def create_browser_frame(content_img, title_step, url_text, width=1000, height=625):
    # Base canvas
    canvas = Image.new('RGB', (width, height), '#0F172A')
    draw = ImageDraw.Draw(canvas)

    # Outer browser window
    margin = 8
    window_w = width - 2 * margin
    window_h = height - 2 * margin
    header_h = 44

    # Window background & header
    draw.rounded_rectangle(
        [margin, margin, margin + window_w, margin + window_h],
        radius=12,
        fill='#FFFFFF',
        outline='#334155',
        width=1
    )

    # Header bar background
    draw.rounded_rectangle(
        [margin, margin, margin + window_w, margin + header_h + 8],
        radius=12,
        fill='#F1F5F9'
    )
    # Fill square corners at bottom of header
    draw.rectangle(
        [margin, margin + 20, margin + window_w, margin + header_h],
        fill='#F1F5F9'
    )
    # Header separator line
    draw.line(
        [(margin, margin + header_h), (margin + window_w, margin + header_h)],
        fill='#E2E8F0',
        width=1
    )

    # Window traffic lights
    dot_y = margin + 22
    draw.ellipse([margin + 16, dot_y - 6, margin + 28, dot_y + 6], fill='#EF4444')
    draw.ellipse([margin + 34, dot_y - 6, margin + 46, dot_y + 6], fill='#F59E0B')
    draw.ellipse([margin + 52, dot_y - 6, margin + 64, dot_y + 6], fill='#10B981')

    # Try loading default font or system font
    try:
        font_sm = ImageFont.truetype("arial.ttf", 12)
        font_bold = ImageFont.truetype("arialbd.ttf", 12)
    except:
        font_sm = ImageFont.load_default()
        font_bold = ImageFont.load_default()

    # URL pill in center
    url_box_w = 400
    url_box_x = (width - url_box_w) // 2
    url_box_y = margin + 10
    draw.rounded_rectangle(
        [url_box_x, url_box_y, url_box_x + url_box_w, url_box_y + 24],
        radius=6,
        fill='#FFFFFF',
        outline='#CBD5E1',
        width=1
    )
    # Lock icon and text
    draw.text((url_box_x + 12, url_box_y + 5), "🔒 " + url_text, fill='#334155', font=font_sm)

    # Step indicator pill on right
    step_box_w = 260
    step_box_x = margin + window_w - step_box_w - 12
    step_box_y = margin + 10
    draw.rounded_rectangle(
        [step_box_x, step_box_y, step_box_x + step_box_w, step_box_y + 24],
        radius=6,
        fill='#EFF6FF',
        outline='#93C5FD',
        width=1
    )
    draw.text((step_box_x + 10, step_box_y + 5), title_step, fill='#1D4ED8', font=font_bold)

    # Body viewport dimensions
    body_x = margin
    body_y = margin + header_h
    body_w = window_w
    body_h = window_h - header_h

    # Resize and crop content image to fit body viewport precisely
    cw, ch = content_img.size
    target_aspect = body_w / body_h
    current_aspect = cw / ch

    if current_aspect > target_aspect:
        # Image is wider: fit height and crop width from center/left
        scale = body_h / ch
        new_w = int(cw * scale)
        resized = content_img.resize((new_w, body_h), Image.Resampling.LANCZOS)
        crop_x = min(new_w - body_w, max(0, (new_w - body_w) // 3))
        cropped = resized.crop((crop_x, 0, crop_x + body_w, body_h))
    else:
        # Image is taller: fit width and crop height from top
        scale = body_w / cw
        new_h = int(ch * scale)
        resized = content_img.resize((body_w, new_h), Image.Resampling.LANCZOS)
        cropped = resized.crop((0, 0, body_w, body_h))

    canvas.paste(cropped, (body_x, body_y))
    return canvas

def generate_demo_gif():
    base_dir = 'd:/HealthCare_Project'
    out_path = f'{base_dir}/docs/assets/demo.gif'

    slides = [
        {
            'path': f'{base_dir}/docs/assets/screenshots/01-desktop-homepage.png',
            'title': '1/6 • Trang chủ & Tìm kiếm Y tế',
            'url': 'www.healthcare.id.vn/'
        },
        {
            'path': f'{base_dir}/docs/assets/screenshots/06-specialties-catalog.png',
            'title': '2/6 • Danh mục Chuyên khoa & Dịch vụ',
            'url': 'www.healthcare.id.vn/specialties'
        },
        {
            'path': f'{base_dir}/docs/assets/screenshots/07-doctors-directory.png',
            'title': '3/6 • Danh bạ Bác sĩ & Lịch khám',
            'url': 'www.healthcare.id.vn/doctors'
        },
        {
            'path': f'{base_dir}/docs/assets/screenshots/08-ai-medical-assistant.png',
            'title': '4/6 • Trợ lý AI Y tế (RAG & Safety)',
            'url': 'www.healthcare.id.vn/ai-assistant'
        },
        {
            'path': f'{base_dir}/docs/assets/screenshots/02-patient-hub.png',
            'title': '5/6 • Cổng Bệnh nhân (Hồ sơ khám)',
            'url': 'www.healthcare.id.vn/patient'
        },
        {
            'path': f'{base_dir}/docs/assets/screenshots/03-doctor-clinical-dashboard.png',
            'title': '6/6 • Cổng Lâm sàng Bác sĩ (Doctor)',
            'url': 'www.healthcare.id.vn/doctor'
        }
    ]

    frames = []
    durations = []

    # Generate main frames
    main_frames = []
    for s in slides:
        img = Image.open(s['path']).convert('RGB')
        frame = create_browser_frame(img, s['title'], s['url'], width=1000, height=625)
        main_frames.append(frame)

    # Build sequence with subtle cross-fade transition
    for i, curr_frame in enumerate(main_frames):
        # Hold slide for 2000ms
        frames.append(curr_frame)
        durations.append(2000)

        # 1 blend frame to next slide (150ms)
        next_frame = main_frames[(i + 1) % len(main_frames)]
        blend = Image.blend(curr_frame, next_frame, alpha=0.5)
        frames.append(blend)
        durations.append(150)

    # Convert frames to adaptive palette
    palette_frames = []
    for f in frames:
        # Quantize to 256 colors with dithering
        p_frame = f.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        palette_frames.append(p_frame)

    print(f"Saving GIF with {len(palette_frames)} frames...")
    palette_frames[0].save(
        out_path,
        save_all=True,
        append_images=palette_frames[1:],
        duration=durations,
        loop=0,
        optimize=True
    )

    file_size = os.path.getsize(out_path) / (1024 * 1024)
    print(f"Demo GIF saved to: {out_path} ({file_size:.2f} MB)")

if __name__ == '__main__':
    generate_demo_gif()
