package com.healthcare.academic.repository;

import com.healthcare.academic.entity.FacultyLecturer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface FacultyLecturerRepository extends JpaRepository<FacultyLecturer, UUID> {

    Optional<FacultyLecturer> findByDoctorId(UUID doctorId);

    @Query("SELECT f FROM FacultyLecturer f JOIN f.doctor d WHERE d.userId = :userId")
    Optional<FacultyLecturer> findByDoctorUserId(@Param("userId") UUID userId);

    @Query("SELECT f FROM FacultyLecturer f JOIN f.doctor d WHERE d.slug = :doctorSlug")
    Optional<FacultyLecturer> findByDoctorSlug(@Param("doctorSlug") String doctorSlug);
}
