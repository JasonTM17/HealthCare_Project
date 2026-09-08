import os
from PIL import Image

def process_screenshots():
    src_dir = 'd:/HealthCare_Project'
    out_dir = 'd:/HealthCare_Project/docs/assets/screenshots'
    os.makedirs(out_dir, exist_ok=True)

    # 1. Desktop Homepage
    img = Image.open(f'{src_dir}/verification_screenshots/final_01_homepage.png')
    img.save(f'{out_dir}/01-desktop-homepage.png', quality=95, optimize=True)
    print("Saved 01-desktop-homepage.png:", img.size)

    # 2. Patient Hub
    img = Image.open(f'{src_dir}/verification_screenshots/final_04_patient_dashboard_overview.png')
    img.save(f'{out_dir}/02-patient-hub.png', quality=95, optimize=True)
    print("Saved 02-patient-hub.png:", img.size)

    # 3. Doctor Clinical Dashboard
    img = Image.open(f'{src_dir}/verification_screenshots/v2_04_doctor_articles_feed.png')
    img.save(f'{out_dir}/03-doctor-clinical-dashboard.png', quality=95, optimize=True)
    print("Saved 03-doctor-clinical-dashboard.png:", img.size)

    # 4. Admin AI Governance
    img = Image.open(f'{src_dir}/verification_screenshots/final_05_admin_ai_reviews_table.png')
    img.save(f'{out_dir}/04-admin-ai-governance.png', quality=95, optimize=True)
    print("Saved 04-admin-ai-governance.png:", img.size)

    # 5. Mobile Responsive (Crop standard iPhone 14/15 viewport 390x844 or top 1000px)
    img_mob = Image.open(f'{src_dir}/verification_screenshots/ui-polish/final_mobile_home.png')
    # Let's crop top 390x844 and scale 2x to 780x1688 for high-DPI display
    crop_mob = img_mob.crop((0, 0, 390, 844))
    crop_mob_2x = crop_mob.resize((780, 1688), Image.Resampling.LANCZOS)
    crop_mob_2x.save(f'{out_dir}/05-mobile-responsive.png', quality=95, optimize=True)
    print("Saved 05-mobile-responsive.png:", crop_mob_2x.size)

    # 6. Specialties Catalog (Crop top 1440x960 and save crisp)
    img_spec = Image.open(f'{src_dir}/verification_screenshots/ui-polish/final_specialties.png')
    crop_spec = img_spec.crop((0, 0, 1440, min(1080, img_spec.height)))
    crop_spec.save(f'{out_dir}/06-specialties-catalog.png', quality=95, optimize=True)
    print("Saved 06-specialties-catalog.png:", crop_spec.size)

    # 7. Doctors Directory (Crop top 1440x1080)
    img_doc = Image.open(f'{src_dir}/verification_screenshots/ui-polish/final_doctors.png')
    crop_doc = img_doc.crop((0, 0, 1440, min(1080, img_doc.height)))
    crop_doc.save(f'{out_dir}/07-doctors-directory.png', quality=95, optimize=True)
    print("Saved 07-doctors-directory.png:", crop_doc.size)

    # 8. AI Medical Assistant
    img_ast = Image.open(f'{src_dir}/verification_screenshots/polish-assistant-2026-09-06.png')
    img_ast.save(f'{out_dir}/08-ai-medical-assistant.png', quality=95, optimize=True)
    print("Saved 08-ai-medical-assistant.png:", img_ast.size)

    # 9. Booking Wizard
    img_bkg = Image.open(f'{src_dir}/verification_screenshots/polish-booking-wizard-2026-09-06.png')
    img_bkg.save(f'{out_dir}/09-booking-wizard.png', quality=95, optimize=True)
    print("Saved 09-booking-wizard.png:", img_bkg.size)

if __name__ == '__main__':
    process_screenshots()
