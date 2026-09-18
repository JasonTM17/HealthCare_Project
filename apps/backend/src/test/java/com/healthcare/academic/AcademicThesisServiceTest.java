package com.healthcare.academic;

import com.healthcare.academic.dto.AcademicThesisResponse;
import com.healthcare.academic.dto.CreateAcademicThesisRequest;
import com.healthcare.academic.dto.FacultyLecturerResponse;
import com.healthcare.academic.dto.GradeAcademicThesisRequest;
import com.healthcare.academic.dto.UpdateAcademicThesisRequest;
import com.healthcare.academic.entity.AcademicThesis;
import com.healthcare.academic.entity.FacultyLecturer;
import com.healthcare.academic.repository.AcademicThesisRepository;
import com.healthcare.academic.repository.DefenseCommitteeMemberRepository;
import com.healthcare.academic.repository.FacultyLecturerRepository;
import com.healthcare.academic.service.AcademicThesisService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.ForbiddenException;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AcademicThesisServiceTest {

    private AcademicThesisRepository thesisRepository;
    private FacultyLecturerRepository facultyLecturerRepository;
    private DefenseCommitteeMemberRepository committeeMemberRepository;
    private DoctorRepository doctorRepository;
    private SpecialtyRepository specialtyRepository;
    private UserRepository userRepository;

    private AcademicThesisService service;

    private User doctorUser;
    private Doctor doctor;
    private FacultyLecturer lecturer;
    private UserDetails doctorActor;

    @BeforeEach
    void setUp() {
        thesisRepository = Mockito.mock(AcademicThesisRepository.class);
        facultyLecturerRepository = Mockito.mock(FacultyLecturerRepository.class);
        committeeMemberRepository = Mockito.mock(DefenseCommitteeMemberRepository.class);
        doctorRepository = Mockito.mock(DoctorRepository.class);
        specialtyRepository = Mockito.mock(SpecialtyRepository.class);
        userRepository = Mockito.mock(UserRepository.class);

        service = new AcademicThesisService(
            thesisRepository,
            facultyLecturerRepository,
            committeeMemberRepository,
            doctorRepository,
            specialtyRepository,
            userRepository
        );

        UUID userId = UUID.randomUUID();
        doctorUser = new User();
        doctorUser.setId(userId);
        doctorUser.setEmail("khoi.nguyen@healthcare.com");

        doctor = new Doctor();
        doctor.setId(UUID.randomUUID());
        doctor.setUserId(userId);
        doctor.setFullName("TS.BS Nguyễn Minh Khôi");
        doctor.setBio("Chuyên gia tim mạch");

        lecturer = new FacultyLecturer();
        lecturer.setId(UUID.randomUUID());
        lecturer.setDoctor(doctor);
        lecturer.setAcademicRank("TS");
        lecturer.setDepartment("Bộ môn Nội Tim mạch");
        lecturer.setMaxTheses(5);
        lecturer.setCurrentThesesCount(1);

        doctorActor = new org.springframework.security.core.userdetails.User(
            "khoi.nguyen@healthcare.com",
            "secret",
            List.of(new SimpleGrantedAuthority("ROLE_DOCTOR"))
        );

        when(userRepository.findByEmail("khoi.nguyen@healthcare.com")).thenReturn(Optional.of(doctorUser));
        when(doctorRepository.findByUserId(userId)).thenReturn(Optional.of(doctor));
        when(facultyLecturerRepository.findByDoctorId(doctor.getId())).thenReturn(Optional.of(lecturer));
        when(facultyLecturerRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(thesisRepository.save(any())).thenAnswer(i -> {
            AcademicThesis t = i.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });
    }

    @Test
    @DisplayName("Successfully creates new thesis when within lecturer quota")
    void createThesisWithinQuota() {
        when(thesisRepository.findByTopicCode("KL-2026-TM-99")).thenReturn(Optional.empty());
        when(thesisRepository.countByPrimarySupervisorIdAndStatusNot(lecturer.getId(), "DEFENDED")).thenReturn(2L);

        CreateAcademicThesisRequest request = new CreateAcademicThesisRequest(
            "KL-2026-TM-99",
            "Nghiên cứu can thiệp mạch vành ở bệnh nhân cao tuổi",
            "Tóm tắt nghiên cứu lâm sàng...",
            "2025-2026",
            "GRADUATION_THESIS",
            null,
            "BS. Lê Văn Nam",
            "Y2020-0099",
            null,
            "Đề cương sơ bộ"
        );

        AcademicThesisResponse response = service.createThesis(request, doctorActor);

        assertNotNull(response);
        assertEquals("KL-2026-TM-99", response.topicCode());
        assertEquals("PROPOSED", response.status());
        assertEquals("TS.BS Nguyễn Minh Khôi", response.supervisorName());
        verify(thesisRepository).save(any(AcademicThesis.class));
    }

    @Test
    @DisplayName("Rejects creating thesis when lecturer exceeds max theses quota")
    void rejectCreateWhenQuotaExceeded() {
        when(thesisRepository.findByTopicCode("KL-2026-TM-99")).thenReturn(Optional.empty());
        // Max is 5, currently 5 active theses
        when(thesisRepository.countByPrimarySupervisorIdAndStatusNot(lecturer.getId(), "DEFENDED")).thenReturn(5L);

        CreateAcademicThesisRequest request = new CreateAcademicThesisRequest(
            "KL-2026-TM-99",
            "Nghiên cứu quá tải",
            "Tóm tắt",
            "2025-2026",
            "GRADUATION_THESIS",
            null,
            "Sinh viên",
            "Y2020",
            null,
            null
        );

        BusinessException ex = assertThrows(BusinessException.class, () ->
            service.createThesis(request, doctorActor)
        );
        assertEquals(400, ex.getStatus());
        assertEquals("THESIS_QUOTA_EXCEEDED", ex.getCode());
        verify(thesisRepository, never()).save(any());
    }

    @Test
    @DisplayName("Rejects creating thesis when topic code already exists")
    void rejectDuplicateTopicCode() {
        AcademicThesis existing = new AcademicThesis();
        existing.setTopicCode("KL-2026-TM-01");
        when(thesisRepository.findByTopicCode("KL-2026-TM-01")).thenReturn(Optional.of(existing));

        CreateAcademicThesisRequest request = new CreateAcademicThesisRequest(
            "KL-2026-TM-01",
            "Tên đề tài",
            "Tóm tắt",
            "2025-2026",
            "GRADUATION_THESIS",
            null,
            "Sinh viên",
            "Y2020",
            null,
            null
        );

        assertThrows(DuplicateResourceException.class, () ->
            service.createThesis(request, doctorActor)
        );
    }

    @Test
    @DisplayName("Supervisor can grade defended thesis and status updates to DEFENDED")
    void gradeThesisSuccessfully() {
        UUID thesisId = UUID.randomUUID();
        AcademicThesis thesis = new AcademicThesis();
        thesis.setId(thesisId);
        thesis.setTopicCode("KL-2026-TM-01");
        thesis.setTitle("Đề tài tốt nghiệp");
        thesis.setPrimarySupervisor(lecturer);
        thesis.setStatus("DEFENSE_SCHEDULED");

        when(thesisRepository.findById(thesisId)).thenReturn(Optional.of(thesis));
        when(thesisRepository.countByPrimarySupervisorIdAndStatusNot(lecturer.getId(), "DEFENDED")).thenReturn(0L);

        GradeAcademicThesisRequest gradeReq = new GradeAcademicThesisRequest(
            new BigDecimal("9.50"),
            "Hội trường A",
            OffsetDateTime.now(),
            "Bảo vệ xuất sắc"
        );

        AcademicThesisResponse res = service.gradeThesis(thesisId, gradeReq, doctorActor);

        assertEquals("DEFENDED", res.status());
        assertEquals(new BigDecimal("9.50"), res.defenseScore());
        assertEquals("Hội trường A", res.defenseLocation());
    }

    @Test
    @DisplayName("Rejects grading thesis if logged-in doctor is not the primary supervisor")
    void rejectGradingByNonSupervisor() {
        UUID thesisId = UUID.randomUUID();
        FacultyLecturer otherLecturer = new FacultyLecturer();
        otherLecturer.setId(UUID.randomUUID());

        AcademicThesis thesis = new AcademicThesis();
        thesis.setId(thesisId);
        thesis.setPrimarySupervisor(otherLecturer);

        when(thesisRepository.findById(thesisId)).thenReturn(Optional.of(thesis));

        GradeAcademicThesisRequest gradeReq = new GradeAcademicThesisRequest(
            new BigDecimal("9.00"),
            "Hội trường B",
            OffsetDateTime.now(),
            "Nhận xét"
        );

        assertThrows(ForbiddenException.class, () ->
            service.gradeThesis(thesisId, gradeReq, doctorActor)
        );
    }

    @Test
    @DisplayName("Auto provisions FacultyLecturer profile if doctor has none")
    void autoProvisionsFacultyProfile() {
        when(facultyLecturerRepository.findByDoctorId(doctor.getId())).thenReturn(Optional.empty());
        when(thesisRepository.countByPrimarySupervisorIdAndStatusNot(any(), eq("DEFENDED"))).thenReturn(0L);

        FacultyLecturerResponse profile = service.getFacultyProfile(doctorActor);

        assertNotNull(profile);
        assertEquals("TS.BS Nguyễn Minh Khôi", profile.doctorName());
        assertEquals("TS", profile.academicRank());
        verify(facultyLecturerRepository, atLeastOnce()).save(any(FacultyLecturer.class));
    }
}
