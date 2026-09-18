package com.healthcare.academic.service;

import com.healthcare.academic.dto.AcademicThesisResponse;
import com.healthcare.academic.dto.CreateAcademicThesisRequest;
import com.healthcare.academic.dto.DefenseCommitteeMemberResponse;
import com.healthcare.academic.dto.FacultyLecturerResponse;
import com.healthcare.academic.dto.GradeAcademicThesisRequest;
import com.healthcare.academic.dto.UpdateAcademicThesisRequest;
import com.healthcare.academic.entity.AcademicThesis;
import com.healthcare.academic.entity.DefenseCommitteeMember;
import com.healthcare.academic.entity.FacultyLecturer;
import com.healthcare.academic.repository.AcademicThesisRepository;
import com.healthcare.academic.repository.DefenseCommitteeMemberRepository;
import com.healthcare.academic.repository.FacultyLecturerRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.ForbiddenException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class AcademicThesisService {

    private final AcademicThesisRepository thesisRepository;
    private final FacultyLecturerRepository facultyLecturerRepository;
    private final DefenseCommitteeMemberRepository committeeMemberRepository;
    private final DoctorRepository doctorRepository;
    private final SpecialtyRepository specialtyRepository;
    private final UserRepository userRepository;

    public AcademicThesisService(
            AcademicThesisRepository thesisRepository,
            FacultyLecturerRepository facultyLecturerRepository,
            DefenseCommitteeMemberRepository committeeMemberRepository,
            DoctorRepository doctorRepository,
            SpecialtyRepository specialtyRepository,
            UserRepository userRepository) {
        this.thesisRepository = thesisRepository;
        this.facultyLecturerRepository = facultyLecturerRepository;
        this.committeeMemberRepository = committeeMemberRepository;
        this.doctorRepository = doctorRepository;
        this.specialtyRepository = specialtyRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public FacultyLecturerResponse getFacultyProfile(UserDetails actor) {
        FacultyLecturer lecturer = resolveOrCreateLecturer(actor);
        long activeCount = thesisRepository.countByPrimarySupervisorIdAndStatusNot(lecturer.getId(), "DEFENDED");
        lecturer.setCurrentThesesCount((int) activeCount);
        facultyLecturerRepository.save(lecturer);
        return toLecturerResponse(lecturer);
    }

    @Transactional(readOnly = true)
    public Page<AcademicThesisResponse> listThesesForDoctor(
            UserDetails actor, String status, String academicYear, Pageable pageable) {
        FacultyLecturer lecturer = resolveOrCreateLecturer(actor);
        return thesisRepository.findBySupervisorWithFilters(lecturer.getId(), status, academicYear, pageable)
                .map(this::toThesisResponseWithCommittee);
    }

    @Transactional(readOnly = true)
    public AcademicThesisResponse getThesisDetail(UUID thesisId, UserDetails actor) {
        AcademicThesis thesis = thesisRepository.findById(thesisId)
                .orElseThrow(() -> new ResourceNotFoundException("Đề tài khóa luận không tồn tại: " + thesisId));
        return toThesisResponseWithCommittee(thesis);
    }

    @Transactional
    public AcademicThesisResponse createThesis(CreateAcademicThesisRequest request, UserDetails actor) {
        FacultyLecturer lecturer = resolveOrCreateLecturer(actor);

        if (thesisRepository.findByTopicCode(request.topicCode().trim()).isPresent()) {
            throw new DuplicateResourceException("Mã đề tài đã tồn tại: " + request.topicCode());
        }

        long activeCount = thesisRepository.countByPrimarySupervisorIdAndStatusNot(lecturer.getId(), "DEFENDED");
        if (activeCount >= lecturer.getMaxTheses()) {
            throw new BusinessException(400, "THESIS_QUOTA_EXCEEDED",
                    "Giảng viên đã đạt giới hạn hướng dẫn tối đa (" + lecturer.getMaxTheses() + " đề tài). Vui lòng hoàn tất hoặc bảo vệ các đề tài hiện có trước khi nhận thêm.");
        }

        Specialty specialty = null;
        if (request.specialtyId() != null) {
            specialty = specialtyRepository.findById(request.specialtyId()).orElse(null);
        }

        AcademicThesis thesis = new AcademicThesis();
        thesis.setTopicCode(request.topicCode().trim().toUpperCase());
        thesis.setTitle(request.title().trim());
        thesis.setAbstractText(request.abstractText() != null ? request.abstractText().trim() : null);
        thesis.setAcademicYear(request.academicYear().trim());
        thesis.setTrainingLevel(request.trainingLevel().trim().toUpperCase());
        thesis.setSpecialty(specialty);
        thesis.setPrimarySupervisor(lecturer);
        thesis.setStudentName(request.studentName().trim());
        thesis.setStudentCode(request.studentCode().trim().toUpperCase());
        thesis.setStatus("PROPOSED");
        thesis.setThesisDocumentUrl(request.thesisDocumentUrl());
        thesis.setSubmissionNotes(request.submissionNotes());

        AcademicThesis saved = thesisRepository.save(thesis);
        lecturer.setCurrentThesesCount((int) (activeCount + 1));
        facultyLecturerRepository.save(lecturer);

        return toThesisResponse(saved, List.of());
    }

    @Transactional
    public AcademicThesisResponse updateThesis(UUID thesisId, UpdateAcademicThesisRequest request, UserDetails actor) {
        FacultyLecturer lecturer = resolveOrCreateLecturer(actor);
        AcademicThesis thesis = thesisRepository.findById(thesisId)
                .orElseThrow(() -> new ResourceNotFoundException("Đề tài khóa luận không tồn tại: " + thesisId));

        if (!thesis.getPrimarySupervisor().getId().equals(lecturer.getId())) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa đề tài do giảng viên khác hướng dẫn");
        }

        if (request.title() != null && !request.title().isBlank()) {
            thesis.setTitle(request.title().trim());
        }
        if (request.abstractText() != null) {
            thesis.setAbstractText(request.abstractText().trim());
        }
        if (request.academicYear() != null && !request.academicYear().isBlank()) {
            thesis.setAcademicYear(request.academicYear().trim());
        }
        if (request.trainingLevel() != null && !request.trainingLevel().isBlank()) {
            thesis.setTrainingLevel(request.trainingLevel().trim().toUpperCase());
        }
        if (request.specialtyId() != null) {
            specialtyRepository.findById(request.specialtyId()).ifPresent(thesis::setSpecialty);
        }
        if (request.studentName() != null && !request.studentName().isBlank()) {
            thesis.setStudentName(request.studentName().trim());
        }
        if (request.studentCode() != null && !request.studentCode().isBlank()) {
            thesis.setStudentCode(request.studentCode().trim().toUpperCase());
        }
        if (request.status() != null && !request.status().isBlank()) {
            thesis.setStatus(request.status().trim().toUpperCase());
        }
        if (request.thesisDocumentUrl() != null) {
            thesis.setThesisDocumentUrl(request.thesisDocumentUrl().trim());
        }
        if (request.submissionNotes() != null) {
            thesis.setSubmissionNotes(request.submissionNotes().trim());
        }

        AcademicThesis updated = thesisRepository.save(thesis);
        return toThesisResponseWithCommittee(updated);
    }

    @Transactional
    public AcademicThesisResponse gradeThesis(UUID thesisId, GradeAcademicThesisRequest request, UserDetails actor) {
        FacultyLecturer lecturer = resolveOrCreateLecturer(actor);
        AcademicThesis thesis = thesisRepository.findById(thesisId)
                .orElseThrow(() -> new ResourceNotFoundException("Đề tài khóa luận không tồn tại: " + thesisId));

        if (!thesis.getPrimarySupervisor().getId().equals(lecturer.getId())) {
            throw new ForbiddenException("Chỉ giảng viên hướng dẫn chính mới có quyền cập nhật điểm bảo vệ đề tài");
        }

        thesis.setDefenseScore(request.defenseScore());
        thesis.setStatus("DEFENDED");
        if (request.defenseLocation() != null && !request.defenseLocation().isBlank()) {
            thesis.setDefenseLocation(request.defenseLocation().trim());
        }
        if (request.defenseDate() != null) {
            thesis.setDefenseDate(request.defenseDate());
        }
        if (request.submissionNotes() != null && !request.submissionNotes().isBlank()) {
            thesis.setSubmissionNotes(request.submissionNotes().trim());
        }

        AcademicThesis graded = thesisRepository.save(thesis);
        long activeCount = thesisRepository.countByPrimarySupervisorIdAndStatusNot(lecturer.getId(), "DEFENDED");
        lecturer.setCurrentThesesCount((int) activeCount);
        facultyLecturerRepository.save(lecturer);

        return toThesisResponseWithCommittee(graded);
    }

    public FacultyLecturer resolveOrCreateLecturer(UserDetails actor) {
        if (actor == null) {
            throw new ForbiddenException("Yêu cầu xác thực tài khoản bác sĩ / giảng viên");
        }
        User user = null;
        if (actor instanceof HealthcareUserPrincipal principal) {
            user = userRepository.findById(principal.getUserId()).orElse(null);
        }
        if (user == null) {
            user = userRepository.findByEmail(actor.getUsername()).orElse(null);
        }
        if (user == null) {
            throw new ResourceNotFoundException("Không tìm thấy thông tin tài khoản người dùng");
        }

        Doctor doctor = doctorRepository.findByUserId(user.getId()).orElse(null);
        if (doctor == null) {
            throw new ForbiddenException("Tài khoản chưa được liên kết với hồ sơ Bác sĩ y khoa");
        }

        return facultyLecturerRepository.findByDoctorId(doctor.getId())
                .orElseGet(() -> {
                    FacultyLecturer created = new FacultyLecturer();
                    created.setDoctor(doctor);
                    String name = doctor.getFullName() != null ? doctor.getFullName() : "";
                    if (name.contains("GS")) created.setAcademicRank("GS");
                    else if (name.contains("PGS")) created.setAcademicRank("PGS");
                    else if (name.contains("TS")) created.setAcademicRank("TS");
                    else if (name.contains("BS.CKII")) created.setAcademicRank("BS.CKII");
                    else if (name.contains("ThS")) created.setAcademicRank("ThS");
                    else created.setAcademicRank("BS.CKI");

                    created.setAcademicTitle("Giảng viên Bộ môn Lâm sàng");
                    created.setDepartment("Bộ môn Y học Lâm sàng Viện - Trường");
                    created.setMaxTheses(5);
                    created.setCurrentThesesCount(0);
                    created.setBiography(doctor.getBio());
                    return facultyLecturerRepository.save(created);
                });
    }

    private AcademicThesisResponse toThesisResponseWithCommittee(AcademicThesis thesis) {
        List<DefenseCommitteeMemberResponse> committee = committeeMemberRepository.findByThesisId(thesis.getId())
                .stream()
                .map(this::toCommitteeResponse)
                .toList();
        return toThesisResponse(thesis, committee);
    }

    private AcademicThesisResponse toThesisResponse(
            AcademicThesis thesis, List<DefenseCommitteeMemberResponse> committee) {
        String supervisorName = "Giảng viên Hướng dẫn";
        String supervisorRank = "ThS";
        String department = "Bộ môn Y học";
        if (thesis.getPrimarySupervisor() != null) {
            FacultyLecturer sup = thesis.getPrimarySupervisor();
            supervisorRank = sup.getAcademicRank();
            department = sup.getDepartment();
            if (sup.getDoctor() != null) {
                supervisorName = sup.getDoctor().getFullName();
            }
        }

        UUID specialtyId = null;
        String specialtyName = null;
        String specialtySlug = null;
        if (thesis.getSpecialty() != null) {
            specialtyId = thesis.getSpecialty().getId();
            specialtyName = thesis.getSpecialty().getName();
            specialtySlug = thesis.getSpecialty().getSlug();
        }

        return new AcademicThesisResponse(
            thesis.getId(),
            thesis.getTopicCode(),
            thesis.getTitle(),
            thesis.getAbstractText(),
            thesis.getAcademicYear(),
            thesis.getTrainingLevel(),
            specialtyId,
            specialtyName,
            specialtySlug,
            thesis.getPrimarySupervisor() != null ? thesis.getPrimarySupervisor().getId() : null,
            supervisorName,
            supervisorRank,
            department,
            thesis.getStudentName(),
            thesis.getStudentCode(),
            thesis.getStatus(),
            thesis.getDefenseScore(),
            thesis.getDefenseDate(),
            thesis.getDefenseLocation(),
            thesis.getThesisDocumentUrl(),
            thesis.getSubmissionNotes(),
            thesis.getCreatedAt(),
            thesis.getUpdatedAt(),
            committee
        );
    }

    private DefenseCommitteeMemberResponse toCommitteeResponse(DefenseCommitteeMember m) {
        String lecturerName = "Thành viên Hội đồng";
        String academicRank = "ThS";
        String department = "Bộ môn";
        if (m.getLecturer() != null) {
            academicRank = m.getLecturer().getAcademicRank();
            department = m.getLecturer().getDepartment();
            if (m.getLecturer().getDoctor() != null) {
                lecturerName = m.getLecturer().getDoctor().getFullName();
            }
        }
        return new DefenseCommitteeMemberResponse(
            m.getId(),
            m.getThesis().getId(),
            m.getLecturer().getId(),
            lecturerName,
            academicRank,
            department,
            m.getCommitteeRole(),
            m.getScore(),
            m.getEvaluationNotes(),
            m.getEvaluatedAt()
        );
    }

    private FacultyLecturerResponse toLecturerResponse(FacultyLecturer l) {
        String doctorName = "Bác sĩ Giảng viên";
        String photoUrl = null;
        UUID doctorId = null;
        if (l.getDoctor() != null) {
            doctorId = l.getDoctor().getId();
            doctorName = l.getDoctor().getFullName();
            photoUrl = l.getDoctor().getPhotoUrl();
        }
        return new FacultyLecturerResponse(
            l.getId(),
            doctorId,
            doctorName,
            photoUrl,
            l.getAcademicRank(),
            l.getAcademicTitle(),
            l.getDepartment(),
            l.getMaxTheses(),
            l.getCurrentThesesCount(),
            l.getBiography(),
            l.isActive()
        );
    }
}
