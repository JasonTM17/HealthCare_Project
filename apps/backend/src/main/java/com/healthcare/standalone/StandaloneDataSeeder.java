package com.healthcare.standalone;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.appointment.entity.DoctorSchedule;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.DoctorScheduleRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.career.entity.EmploymentType;
import com.healthcare.career.entity.JobPosition;
import com.healthcare.career.repository.JobPositionRepository;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.entity.DoctorSpecialty;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.DoctorSpecialtyRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Idempotent, fictional sample catalog for the file-backed standalone profile.
 *
 * <p>The regular PostgreSQL profiles never create this bean. Local data is
 * inserted only when a matching slug does not already exist, so content edited
 * through the admin screens survives subsequent restarts.</p>
 */
@Component
@Profile("standalone")
public class StandaloneDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(StandaloneDataSeeder.class);

    private final ObjectMapper objectMapper;
    private final SpecialtyRepository specialtyRepository;
    private final BranchRepository branchRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorSpecialtyRepository doctorSpecialtyRepository;
    private final DoctorBranchRepository doctorBranchRepository;
    private final ServiceRepository serviceRepository;
    private final PackageRepository packageRepository;
    private final ArticleRepository articleRepository;
    private final FaqRepository faqRepository;
    private final JobPositionRepository jobPositionRepository;
    private final DoctorScheduleRepository scheduleRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final PasswordEncoder passwordEncoder;

    public StandaloneDataSeeder(
            ObjectMapper objectMapper,
            SpecialtyRepository specialtyRepository,
            BranchRepository branchRepository,
            DoctorRepository doctorRepository,
            DoctorSpecialtyRepository doctorSpecialtyRepository,
            DoctorBranchRepository doctorBranchRepository,
            ServiceRepository serviceRepository,
            PackageRepository packageRepository,
            ArticleRepository articleRepository,
            FaqRepository faqRepository,
            JobPositionRepository jobPositionRepository,
            DoctorScheduleRepository scheduleRepository,
            RoleRepository roleRepository,
            UserRepository userRepository,
            PatientProfileRepository patientProfileRepository,
            PasswordEncoder passwordEncoder) {
        this.objectMapper = objectMapper;
        this.specialtyRepository = specialtyRepository;
        this.branchRepository = branchRepository;
        this.doctorRepository = doctorRepository;
        this.doctorSpecialtyRepository = doctorSpecialtyRepository;
        this.doctorBranchRepository = doctorBranchRepository;
        this.serviceRepository = serviceRepository;
        this.packageRepository = packageRepository;
        this.articleRepository = articleRepository;
        this.faqRepository = faqRepository;
        this.jobPositionRepository = jobPositionRepository;
        this.scheduleRepository = scheduleRepository;
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.patientProfileRepository = patientProfileRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedLocalAccounts();
        Map<String, Specialty> specialties = seedSpecialties();
        Map<String, Branch> branches = seedBranches();
        List<DoctorSeed> doctors = seedDoctors();

        for (DoctorSeed seed : doctors) {
            Doctor doctor = doctorRepository.findBySlug(seed.slug()).orElseThrow();
            Specialty specialty = specialties.get(seed.specialtySlug());
            Branch branch = branches.get(seed.branchSlug());
            linkDoctorToSpecialty(doctor, specialty);
            linkDoctorToBranch(doctor, branch);
            seedSchedules(doctor, branch);
        }

        linkDemoDoctorAccount();

        seedServices();
        seedPackages();
        seedArticles();
        seedFaqs();
        seedJobPositions();

        log.info(
            "Standalone catalog ready: {} specialties, {} branches, {} doctors, {} schedules",
            specialtyRepository.count(), branchRepository.count(), doctorRepository.count(), scheduleRepository.count()
        );
    }

    private void seedLocalAccounts() {
        Map<String, Role> roles = new LinkedHashMap<>();
        for (RoleSeed seed : List.of(
            new RoleSeed("PATIENT", "Bệnh nhân"),
            new RoleSeed("DOCTOR", "Bác sĩ"),
            new RoleSeed("ADMIN", "Quản trị viên")
        )) {
            Role role = roleRepository.findByCode(seed.code()).orElseGet(() -> {
                Role value = new Role();
                value.setCode(seed.code());
                value.setName(seed.name());
                value.setCreatedAt(OffsetDateTime.now());
                return roleRepository.save(value);
            });
            roles.put(seed.code(), role);
        }

        seedUser("admin@healthcare.local", "Quản trị viên Local", roles.get("ADMIN"));
        seedUser("doctor@healthcare.local", "Bác sĩ Local", roles.get("DOCTOR"));
        User patient = seedUser("patient@healthcare.local", "Bệnh nhân Local", roles.get("PATIENT"));
        if (patientProfileRepository.findByUserId(patient.getId()).isEmpty()
                && patientProfileRepository.findByPhone("0900000001").isEmpty()) {
            PatientProfile profile = new PatientProfile();
            profile.setFullName("Bệnh nhân Local");
            profile.setPhone("0900000001");
            profile.setEmail(patient.getEmail());
            profile.setUserId(patient.getId());
            patientProfileRepository.save(profile);
        }
    }

    private User seedUser(String email, String displayName, Role role) {
        return userRepository.findByEmail(email).orElseGet(() -> {
            User user = new User();
            user.setEmail(email);
            user.setPasswordHash(passwordEncoder.encode("LocalDemo!2026"));
            user.setDisplayName(displayName);
            user.setStatus("ACTIVE");
            user.setCreatedAt(OffsetDateTime.now());
            user.setUpdatedAt(OffsetDateTime.now());
            user.addRole(role);
            return userRepository.save(user);
        });
    }

    private void linkDemoDoctorAccount() {
        User doctorUser = userRepository.findByEmail("doctor@healthcare.local").orElseThrow();
        Doctor doctor = doctorRepository.findBySlug("nguyen-minh-khoi").orElseThrow();
        if (doctor.getUserId() == null) {
            doctor.setUserId(doctorUser.getId());
            doctorRepository.save(doctor);
        }
    }

    private Map<String, Specialty> seedSpecialties() {
        List<SpecialtySeed> seeds = List.of(
            new SpecialtySeed(
                "Tim mạch", "tim-mach",
                "Khám, tầm soát và theo dõi các bệnh lý tim, mạch máu và huyết áp.",
                List.of("Đau tức ngực", "Khó thở khi gắng sức", "Hồi hộp hoặc đánh trống ngực"),
                List.of("Mang theo kết quả đo huyết áp gần đây", "Chuẩn bị danh sách thuốc đang dùng", "Không tự ý ngưng thuốc trước khi khám"),
                "Tiếp nhận → khám chuyên khoa → chỉ định cận lâm sàng → tư vấn kế hoạch theo dõi."
            ),
            new SpecialtySeed(
                "Nội tổng hợp", "noi-tong-hop",
                "Khám tổng quát, sàng lọc nguy cơ và quản lý các bệnh mạn tính thường gặp.",
                List.of("Mệt mỏi kéo dài", "Chỉ số đường huyết bất thường", "Sụt hoặc tăng cân không rõ nguyên nhân"),
                List.of("Mang theo kết quả xét nghiệm cũ", "Liệt kê bệnh nền", "Hỏi trước nếu cần nhịn ăn"),
                "Đánh giá nguy cơ → xét nghiệm phù hợp → tư vấn điều trị → hẹn theo dõi."
            ),
            new SpecialtySeed(
                "Nhi khoa", "nhi-khoa",
                "Chăm sóc sức khỏe trẻ em, theo dõi tăng trưởng và điều trị bệnh lý nhi khoa.",
                List.of("Sốt hoặc ho kéo dài", "Biếng ăn", "Rối loạn tiêu hóa"),
                List.of("Mang sổ tiêm chủng", "Ghi lại thuốc trẻ đã dùng", "Cho trẻ mặc trang phục thoải mái"),
                "Tiếp nhận trẻ → đánh giá tăng trưởng → khám nhi → hướng dẫn chăm sóc và tái khám."
            ),
            new SpecialtySeed(
                "Sản phụ khoa", "san-phu-khoa",
                "Khám phụ khoa, chăm sóc thai kỳ, tư vấn sức khỏe sinh sản và tầm soát định kỳ.",
                List.of("Rối loạn chu kỳ", "Đau bụng dưới", "Cần tư vấn trước và trong thai kỳ"),
                List.of("Ghi lại ngày đầu kỳ kinh gần nhất", "Mang kết quả siêu âm cũ", "Thông báo nếu đang mang thai"),
                "Tư vấn ban đầu → khám và siêu âm khi cần → đọc kết quả → lập lịch theo dõi."
            ),
            new SpecialtySeed(
                "Tiêu hóa", "tieu-hoa",
                "Khám và điều trị các vấn đề dạ dày, đại tràng, gan, mật và dinh dưỡng tiêu hóa.",
                List.of("Đau bụng tái diễn", "Đầy hơi hoặc khó tiêu", "Thay đổi thói quen đại tiện"),
                List.of("Ghi lại thực phẩm gây khó chịu", "Mang theo kết quả nội soi", "Hỏi trước nếu cần nhịn ăn"),
                "Khám lâm sàng → xét nghiệm hoặc nội soi → tư vấn dinh dưỡng và điều trị."
            ),
            new SpecialtySeed(
                "Cơ xương khớp", "co-xuong-khop",
                "Đánh giá và điều trị đau khớp, thoái hóa cột sống, chấn thương và hạn chế vận động.",
                List.of("Đau hoặc cứng khớp", "Hạn chế vận động", "Đau lưng hoặc cổ kéo dài"),
                List.of("Mặc trang phục thuận tiện vận động", "Mang phim chụp nếu có", "Ghi lại thuốc giảm đau đã dùng"),
                "Đánh giá vận động → chẩn đoán hình ảnh khi cần → điều trị và phục hồi chức năng."
            ),
            new SpecialtySeed(
                "Thần kinh", "than-kinh",
                "Khám đau đầu, chóng mặt, rối loạn giấc ngủ và các bệnh lý thần kinh thường gặp.",
                List.of("Đau đầu kéo dài", "Chóng mặt", "Tê hoặc yếu tay chân"),
                List.of("Ghi lại thời điểm xuất hiện triệu chứng", "Mang phim hoặc kết quả cũ", "Nghỉ ngơi trước buổi khám"),
                "Khai thác triệu chứng → khám thần kinh → cận lâm sàng khi cần → hẹn theo dõi."
            ),
            new SpecialtySeed(
                "Tai mũi họng", "tai-mui-hong",
                "Khám và điều trị bệnh lý tai, mũi, họng cho trẻ em và người lớn.",
                List.of("Nghẹt mũi kéo dài", "Đau họng", "Ù tai hoặc nghe kém"),
                List.of("Ghi lại thời gian khởi phát", "Mang thuốc đang sử dụng", "Không tự nhỏ thuốc trước khi khám"),
                "Khám chuyên khoa → nội soi hoặc đo chức năng khi cần → hướng dẫn điều trị."
            )
        );

        Map<String, Specialty> result = new LinkedHashMap<>();
        for (SpecialtySeed seed : seeds) {
            Specialty specialty = specialtyRepository.findBySlug(seed.slug()).orElseGet(() -> {
                Specialty value = new Specialty();
                value.setName(seed.name());
                value.setSlug(seed.slug());
                value.setDescription(seed.description());
                value.setCommonSymptoms(json(seed.symptoms()));
                value.setPreparationSteps(json(seed.preparation()));
                value.setCarePathway(seed.pathway());
                value.setActive(true);
                return specialtyRepository.save(value);
            });
            result.put(seed.slug(), specialty);
        }
        return result;
    }

    private Map<String, Branch> seedBranches() {
        List<BranchSeed> seeds = List.of(
            new BranchSeed(
                "Bệnh viện Đa khoa An Tâm – Trung tâm",
                "benh-vien-an-tam-trung-tam",
                "128 Nguyễn Văn Cừ, Phường Chợ Quán, TP. Hồ Chí Minh",
                "028 3838 1288", "06:30–20:00, thứ Hai–Chủ nhật", "028 3838 1155",
                "https://www.google.com/maps/search/?api=1&query=128+Nguyen+Van+Cu+Ho+Chi+Minh",
                List.of("Cấp cứu 24/7", "Nhà thuốc", "Bãi đỗ xe", "Wi-Fi miễn phí")
            ),
            new BranchSeed(
                "Phòng khám An Tâm – Thảo Điền",
                "phong-kham-an-tam-thao-dien",
                "45 Võ Nguyên Giáp, Phường Thảo Điền, TP. Hồ Chí Minh",
                "028 3744 2233", "07:00–19:00, thứ Hai–Chủ nhật", "028 3744 2200",
                "https://www.google.com/maps/search/?api=1&query=45+Vo+Nguyen+Giap+Thao+Dien+Ho+Chi+Minh",
                List.of("Khám theo hẹn", "Khu lấy mẫu", "Tư vấn bảo hiểm", "Bãi đỗ xe")
            ),
            new BranchSeed(
                "Phòng khám An Tâm – Phú Nhuận",
                "phong-kham-an-tam-phu-nhuan",
                "202 Hoàng Văn Thụ, Phường Đức Nhuận, TP. Hồ Chí Minh",
                "028 3997 2020", "07:00–18:30, thứ Hai–thứ Bảy", "028 3997 2000",
                "https://www.google.com/maps/search/?api=1&query=202+Hoang+Van+Thu+Phu+Nhuan+Ho+Chi+Minh",
                List.of("Khám trong ngày", "Xét nghiệm", "Siêu âm", "Quầy thuốc")
            )
        );

        Map<String, Branch> result = new LinkedHashMap<>();
        for (BranchSeed seed : seeds) {
            Branch branch = branchRepository.findBySlug(seed.slug()).orElseGet(() -> {
                Branch value = new Branch();
                value.setName(seed.name());
                value.setSlug(seed.slug());
                value.setAddress(seed.address());
                value.setPhone(seed.phone());
                value.setWorkingHours(seed.workingHours());
                value.setEmergencyHotline(seed.hotline());
                value.setMapUrl(seed.mapUrl());
                value.setAmenities(json(seed.amenities()));
                value.setActive(true);
                return branchRepository.save(value);
            });
            result.put(seed.slug(), branch);
        }
        return result;
    }

    private List<DoctorSeed> seedDoctors() {
        List<DoctorSeed> seeds = List.of(
            new DoctorSeed("TS.BS Nguyễn Minh Khôi", "nguyen-minh-khoi", "tim-mach", "benh-vien-an-tam-trung-tam", "18 năm kinh nghiệm trong khám, điều trị và theo dõi bệnh tim mạch."),
            new DoctorSeed("ThS.BS Trần Thu Hà", "tran-thu-ha", "than-kinh", "benh-vien-an-tam-trung-tam", "12 năm kinh nghiệm điều trị đau đầu, chóng mặt và rối loạn giấc ngủ."),
            new DoctorSeed("BS.CKI Lê Văn Đức", "le-van-duc", "tieu-hoa", "phong-kham-an-tam-thao-dien", "15 năm kinh nghiệm về tiêu hóa, gan mật và nội soi chẩn đoán."),
            new DoctorSeed("ThS.BS Phạm Hoàng Yến", "pham-hoang-yen", "nhi-khoa", "phong-kham-an-tam-thao-dien", "10 năm đồng hành cùng trẻ em và gia đình trong chăm sóc sức khỏe toàn diện."),
            new DoctorSeed("BS.CKII Võ Thị Mai", "vo-thi-mai", "san-phu-khoa", "benh-vien-an-tam-trung-tam", "20 năm kinh nghiệm sản phụ khoa, chăm sóc thai kỳ và sức khỏe sinh sản."),
            new DoctorSeed("ThS.BS Đỗ Quang Huy", "do-quang-huy", "co-xuong-khop", "phong-kham-an-tam-phu-nhuan", "11 năm kinh nghiệm điều trị bệnh cơ xương khớp và phục hồi vận động."),
            new DoctorSeed("BS.CKI Nguyễn Ngọc Lan", "nguyen-ngoc-lan", "noi-tong-hop", "phong-kham-an-tam-phu-nhuan", "13 năm kinh nghiệm khám tổng quát và quản lý bệnh mạn tính."),
            new DoctorSeed("BS Trương Gia Bảo", "truong-gia-bao", "tai-mui-hong", "benh-vien-an-tam-trung-tam", "9 năm kinh nghiệm khám và điều trị các bệnh lý tai mũi họng.")
        );

        for (DoctorSeed seed : seeds) {
            if (doctorRepository.findBySlug(seed.slug()).isEmpty()) {
                Doctor doctor = new Doctor();
                doctor.setFullName(seed.name());
                doctor.setSlug(seed.slug());
                doctor.setBio(seed.bio());
                doctor.setActive(true);
                doctorRepository.save(doctor);
            }
        }
        return seeds;
    }

    private void linkDoctorToSpecialty(Doctor doctor, Specialty specialty) {
        if (!doctorSpecialtyRepository.existsByDoctorIdAndSpecialtyId(doctor.getId(), specialty.getId())) {
            DoctorSpecialty link = new DoctorSpecialty();
            link.setDoctor(doctor);
            link.setSpecialty(specialty);
            doctorSpecialtyRepository.save(link);
        }
    }

    private void linkDoctorToBranch(Doctor doctor, Branch branch) {
        if (!doctorBranchRepository.existsByDoctorIdAndBranchId(doctor.getId(), branch.getId())) {
            DoctorBranch link = new DoctorBranch();
            link.setDoctor(doctor);
            link.setBranch(branch);
            doctorBranchRepository.save(link);
        }
    }

    private void seedSchedules(Doctor doctor, Branch branch) {
        if (!scheduleRepository.findByDoctorIdAndActiveTrue(doctor.getId()).isEmpty()) {
            return;
        }

        List<DoctorSchedule> schedules = new ArrayList<>();
        for (int dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek++) {
            schedules.add(schedule(doctor, branch, dayOfWeek, LocalTime.of(8, 0), LocalTime.of(11, 30)));
            if (dayOfWeek <= 5) {
                schedules.add(schedule(doctor, branch, dayOfWeek, LocalTime.of(13, 30), LocalTime.of(17, 0)));
            }
        }
        scheduleRepository.saveAll(schedules);
    }

    private DoctorSchedule schedule(Doctor doctor, Branch branch, int dayOfWeek, LocalTime start, LocalTime end) {
        DoctorSchedule schedule = new DoctorSchedule();
        schedule.setDoctor(doctor);
        schedule.setBranch(branch);
        schedule.setDayOfWeek(dayOfWeek);
        schedule.setStartTime(start);
        schedule.setEndTime(end);
        schedule.setSlotDurationMinutes(30);
        schedule.setEffectiveFrom(LocalDate.of(2026, 1, 1));
        schedule.setActive(true);
        return schedule;
    }

    private void seedServices() {
        List<ServiceSeed> seeds = List.of(
            new ServiceSeed("Khám sức khỏe tổng quát", "kham-suc-khoe-tong-quat", "Đánh giá sức khỏe toàn diện và tư vấn kế hoạch chăm sóc cá nhân."),
            new ServiceSeed("Xét nghiệm và chẩn đoán", "xet-nghiem-chan-doan", "Xét nghiệm máu, sinh hóa và các dịch vụ chẩn đoán theo chỉ định."),
            new ServiceSeed("Chẩn đoán hình ảnh", "chan-doan-hinh-anh", "Siêu âm, X-quang và các kỹ thuật hình ảnh hỗ trợ chẩn đoán."),
            new ServiceSeed("Khám chuyên khoa", "kham-chuyen-khoa", "Tư vấn trực tiếp với bác sĩ thuộc nhiều chuyên khoa tại các cơ sở."),
            new ServiceSeed("Tiêm chủng", "tiem-chung", "Tư vấn và tiêm chủng cho trẻ em, người lớn theo lịch khuyến nghị."),
            new ServiceSeed("Theo dõi bệnh mạn tính", "theo-doi-benh-man-tinh", "Quản lý liên tục huyết áp, tiểu đường, tim mạch và các bệnh mạn tính." )
        );
        for (ServiceSeed seed : seeds) {
            if (serviceRepository.findBySlug(seed.slug()).isEmpty()) {
                MedicalService service = new MedicalService();
                service.setName(seed.name());
                service.setSlug(seed.slug());
                service.setDescription(seed.description());
                service.setActive(true);
                serviceRepository.save(service);
            }
        }
    }

    private void seedPackages() {
        List<PackageSeed> seeds = List.of(
            new PackageSeed("Gói khám sức khỏe cơ bản", "goi-kham-suc-khoe-co-ban", "Sàng lọc các chỉ số sức khỏe thiết yếu trong một buổi.", new BigDecimal("1200000"), "Người trưởng thành khám định kỳ", List.of("Khám nội tổng quát", "Xét nghiệm máu cơ bản", "Siêu âm ổ bụng", "Điện tâm đồ")),
            new PackageSeed("Gói tầm soát tim mạch", "goi-tam-soat-tim-mach", "Đánh giá nguy cơ tim mạch và tư vấn theo dõi chuyên sâu.", new BigDecimal("1800000"), "Người có yếu tố nguy cơ tim mạch", List.of("Khám tim mạch", "Điện tâm đồ", "Siêu âm tim", "Xét nghiệm mỡ máu")),
            new PackageSeed("Gói sức khỏe phụ nữ", "goi-suc-khoe-phu-nu", "Kiểm tra sức khỏe tổng quát kết hợp tầm soát phụ khoa.", new BigDecimal("2100000"), "Phụ nữ từ 18 tuổi", List.of("Khám tổng quát", "Khám phụ khoa", "Siêu âm", "Xét nghiệm cơ bản")),
            new PackageSeed("Gói theo dõi sức khỏe trẻ em", "goi-suc-khoe-tre-em", "Đánh giá tăng trưởng, dinh dưỡng và lịch tiêm chủng của trẻ.", new BigDecimal("800000"), "Trẻ em và gia đình", List.of("Khám nhi", "Đánh giá tăng trưởng", "Tư vấn dinh dưỡng", "Rà soát tiêm chủng"))
        );
        for (PackageSeed seed : seeds) {
            if (packageRepository.findBySlug(seed.slug()).isEmpty()) {
                com.healthcare.hospital.entity.Package value = new com.healthcare.hospital.entity.Package();
                value.setName(seed.name());
                value.setSlug(seed.slug());
                value.setDescription(seed.description());
                value.setPrice(seed.price());
                value.setTargetAudience(seed.audience());
                value.setDurationDays(1);
                value.setChecklist(json(seed.checklist()));
                value.setPreparationSteps(json(List.of(
                    "Mang theo giấy tờ tùy thân và kết quả khám gần nhất",
                    "Nhịn ăn theo hướng dẫn nếu gói có xét nghiệm",
                    "Có mặt trước giờ hẹn khoảng 15 phút"
                )));
                value.setActive(true);
                packageRepository.save(value);
            }
        }
    }

    private void seedArticles() {
        List<ArticleSeed> seeds = List.of(
            new ArticleSeed("Những dấu hiệu nên kiểm tra sức khỏe tim mạch", "dau-hieu-nen-kiem-tra-tim-mach", "Đau ngực, khó thở và mệt bất thường cần được đánh giá đúng lúc.", "tim-mach", 5),
            new ArticleSeed("Chuẩn bị gì trước buổi khám sức khỏe tổng quát?", "chuan-bi-truoc-khi-kham-tong-quat", "Một danh sách ngắn giúp buổi khám thuận lợi và kết quả chính xác hơn.", "noi-tong-hop", 4),
            new ArticleSeed("Chăm sóc giấc ngủ để phục hồi tốt hơn", "cham-soc-giac-ngu", "Những thay đổi nhỏ trong giờ ngủ, ánh sáng và vận động có thể cải thiện chất lượng nghỉ ngơi.", "than-kinh", 4)
        );
        int daysAgo = 2;
        for (ArticleSeed seed : seeds) {
            if (articleRepository.findBySlug(seed.slug()).isEmpty()) {
                Article article = new Article();
                article.setTitle(seed.title());
                article.setSlug(seed.slug());
                article.setSummary(seed.summary());
                article.setBody(seed.summary() + " Nếu triệu chứng kéo dài hoặc ảnh hưởng sinh hoạt, bạn nên trao đổi trực tiếp với nhân viên y tế để được đánh giá phù hợp.");
                article.setCategory("Chăm sóc chủ động");
                article.setAuthorName("Đội ngũ chuyên môn An Tâm");
                article.setReadingMinutes(seed.readingMinutes());
                article.setRelatedSpecialtySlug(seed.specialtySlug());
                article.setSections(json(List.of(
                    Map.of("heading", "Điều cần lưu ý", "body", seed.summary()),
                    Map.of("heading", "Khi nào nên đi khám", "body", "Hãy đặt lịch tư vấn khi triệu chứng kéo dài, tăng dần hoặc khiến bạn lo lắng.")
                )));
                article.setPublishedAt(OffsetDateTime.now().minusDays(daysAgo++));
                article.setActive(true);
                articleRepository.save(article);
            }
        }
    }

    private void seedFaqs() {
        if (faqRepository.count() > 0) {
            return;
        }
        List<FaqSeed> seeds = List.of(
            new FaqSeed("Tôi có thể đặt lịch khám bằng cách nào?", "Bạn có thể đặt lịch trực tiếp trên website, chọn cơ sở, chuyên khoa, bác sĩ và giờ khám phù hợp."),
            new FaqSeed("Tôi cần đến trước giờ hẹn bao lâu?", "Bạn nên có mặt trước giờ hẹn khoảng 15 phút để hoàn tất thủ tục tiếp nhận."),
            new FaqSeed("Có cần nhịn ăn trước khi xét nghiệm không?", "Một số xét nghiệm yêu cầu nhịn ăn. Vui lòng xem hướng dẫn của gói khám hoặc liên hệ cơ sở trước khi đến."),
            new FaqSeed("Tôi có thể thay đổi lịch hẹn không?", "Bạn có thể tra cứu lịch bằng mã đặt lịch và số điện thoại để đổi hoặc hủy lịch khi đủ điều kiện.")
        );
        for (FaqSeed seed : seeds) {
            Faq faq = new Faq();
            faq.setQuestion(seed.question());
            faq.setAnswer(seed.answer());
            faq.setActive(true);
            faqRepository.save(faq);
        }
    }

    private void seedJobPositions() {
        List<JobPositionSeed> seeds = List.of(
            new JobPositionSeed(
                "Điều dưỡng đa khoa",
                "dieu-duong-da-khoa",
                "Khối Điều dưỡng",
                "Bệnh viện An Tâm Trung tâm",
                EmploymentType.FULL_TIME,
                "Phối hợp cùng bác sĩ và đội ngũ chăm sóc để hỗ trợ người bệnh trong suốt quá trình thăm khám, điều trị.",
                List.of(
                    "Tiếp nhận, theo dõi và thực hiện chăm sóc người bệnh theo phân công",
                    "Thực hiện đúng quy trình an toàn người bệnh và kiểm soát nhiễm khuẩn",
                    "Ghi nhận thông tin chăm sóc đầy đủ, phối hợp bàn giao giữa các ca"
                ),
                List.of(
                    "Tốt nghiệp Cao đẳng hoặc Đại học chuyên ngành Điều dưỡng",
                    "Có giấy phép hành nghề phù hợp theo quy định hiện hành",
                    "Giao tiếp rõ ràng, tôn trọng người bệnh và phối hợp nhóm tốt"
                ),
                List.of(
                    "Quy trình hội nhập và hướng dẫn công việc rõ ràng",
                    "Tham gia đào tạo chuyên môn theo kế hoạch của bệnh viện",
                    "Chế độ làm việc và phúc lợi theo chính sách hiện hành"
                ),
                true
            ),
            new JobPositionSeed(
                "Kỹ thuật viên xét nghiệm",
                "ky-thuat-vien-xet-nghiem",
                "Khối Cận lâm sàng",
                "Bệnh viện An Tâm Trung tâm",
                EmploymentType.FULL_TIME,
                "Thực hiện các bước tiếp nhận và xử lý mẫu xét nghiệm, góp phần bảo đảm kết quả chính xác và đúng thời gian.",
                List.of(
                    "Tiếp nhận, kiểm tra và xử lý mẫu theo quy trình chuyên môn",
                    "Vận hành thiết bị trong phạm vi được phân công và ghi nhận kiểm soát chất lượng",
                    "Phối hợp trả kết quả và báo cáo các tình huống cần lưu ý"
                ),
                List.of(
                    "Tốt nghiệp chuyên ngành Kỹ thuật xét nghiệm y học",
                    "Cẩn trọng, có khả năng làm việc theo quy trình và theo ca",
                    "Ưu tiên ứng viên có giấy phép hành nghề phù hợp"
                ),
                List.of(
                    "Được hướng dẫn quy trình và hệ thống chất lượng khi nhận việc",
                    "Cơ hội học hỏi trong môi trường phối hợp đa chuyên khoa",
                    "Chế độ làm việc và phúc lợi theo chính sách hiện hành"
                ),
                false
            ),
            new JobPositionSeed(
                "Chuyên viên chăm sóc khách hàng",
                "chuyen-vien-cham-soc-khach-hang",
                "Trải nghiệm người bệnh",
                "Phòng khám An Tâm Thảo Điền",
                EmploymentType.FULL_TIME,
                "Hướng dẫn người bệnh và thân nhân tiếp cận đúng dịch vụ, lịch khám và kênh hỗ trợ tại cơ sở.",
                List.of(
                    "Tiếp nhận nhu cầu, hướng dẫn thủ tục và điều phối thông tin tại quầy",
                    "Giải đáp trong phạm vi được phân công, chuyển tiếp đúng bộ phận khi cần",
                    "Ghi nhận phản hồi để cải thiện trải nghiệm người bệnh"
                ),
                List.of(
                    "Tốt nghiệp Trung cấp, Cao đẳng hoặc Đại học",
                    "Giọng nói rõ ràng, giao tiếp điềm tĩnh và chủ động",
                    "Có thể sử dụng các công cụ văn phòng cơ bản"
                ),
                List.of(
                    "Được đào tạo về quy trình tiếp đón và bảo mật thông tin",
                    "Môi trường làm việc phối hợp và tôn trọng",
                    "Chế độ làm việc và phúc lợi theo chính sách hiện hành"
                ),
                false
            ),
            new JobPositionSeed(
                "Thực tập sinh Hành chính – Nhân sự",
                "thuc-tap-sinh-hanh-chinh-nhan-su",
                "Hành chính – Nhân sự",
                "Văn phòng An Tâm Trung tâm",
                EmploymentType.INTERNSHIP,
                "Hỗ trợ các công việc hành chính, lưu trữ và trải nghiệm nhân viên dưới sự hướng dẫn của phụ trách bộ phận.",
                List.of(
                    "Hỗ trợ chuẩn bị hồ sơ, biểu mẫu và sắp xếp tài liệu",
                    "Phối hợp tổ chức hoạt động nội bộ theo kế hoạch",
                    "Cập nhật tiến độ công việc và bảo mật thông tin được tiếp cận"
                ),
                List.of(
                    "Sinh viên năm cuối các ngành Quản trị nhân lực, Hành chính hoặc ngành liên quan",
                    "Cẩn thận, đúng hẹn và sẵn sàng học hỏi",
                    "Sử dụng được các công cụ văn phòng cơ bản"
                ),
                List.of(
                    "Có người hướng dẫn trong thời gian thực tập",
                    "Được tiếp cận quy trình vận hành trong môi trường bệnh viện",
                    "Xác nhận thực tập theo quy định khi hoàn thành"
                ),
                false
            )
        );

        for (JobPositionSeed seed : seeds) {
            if (jobPositionRepository.findBySlug(seed.slug()).isPresent()) continue;
            JobPosition job = new JobPosition();
            job.setTitle(seed.title());
            job.setSlug(seed.slug());
            job.setDepartment(seed.department());
            job.setLocation(seed.location());
            job.setEmploymentType(seed.employmentType());
            job.setSummary(seed.summary());
            job.setResponsibilities(String.join("\n", seed.responsibilities()));
            job.setRequirements(String.join("\n", seed.requirements()));
            job.setBenefits(String.join("\n", seed.benefits()));
            job.setFeatured(seed.featured());
            job.setActive(true);
            jobPositionRepository.save(job);
        }
    }

    private JsonNode json(Object value) {
        return objectMapper.valueToTree(value);
    }

    private record SpecialtySeed(String name, String slug, String description, List<String> symptoms,
                                 List<String> preparation, String pathway) {}
    private record BranchSeed(String name, String slug, String address, String phone, String workingHours,
                              String hotline, String mapUrl, List<String> amenities) {}
    private record DoctorSeed(String name, String slug, String specialtySlug, String branchSlug, String bio) {}
    private record ServiceSeed(String name, String slug, String description) {}
    private record PackageSeed(String name, String slug, String description, BigDecimal price, String audience,
                               List<String> checklist) {}
    private record ArticleSeed(String title, String slug, String summary, String specialtySlug, int readingMinutes) {}
    private record FaqSeed(String question, String answer) {}
    private record JobPositionSeed(String title, String slug, String department, String location,
                                   EmploymentType employmentType, String summary,
                                   List<String> responsibilities, List<String> requirements,
                                   List<String> benefits, boolean featured) {}
    private record RoleSeed(String code, String name) {}
}
