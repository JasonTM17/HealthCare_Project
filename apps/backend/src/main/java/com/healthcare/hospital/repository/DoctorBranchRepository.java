package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.DoctorBranch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;
import java.util.List;
import java.util.Optional;

@Repository
public interface DoctorBranchRepository extends JpaRepository<DoctorBranch, UUID> {

    boolean existsByDoctorIdAndBranchId(UUID doctorId, UUID branchId);

    List<DoctorBranch> findByDoctorId(UUID doctorId);

    List<DoctorBranch> findByBranchId(UUID branchId);

    Optional<DoctorBranch> findFirstByDoctorId(UUID doctorId);
}
