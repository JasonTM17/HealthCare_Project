package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.DoctorBranch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DoctorBranchRepository extends JpaRepository<DoctorBranch, UUID> {

    boolean existsByDoctorIdAndBranchId(UUID doctorId, UUID branchId);

    List<DoctorBranch> findByDoctorId(UUID doctorId);

    List<DoctorBranch> findByBranchId(UUID branchId);

    Optional<DoctorBranch> findFirstByDoctorId(UUID doctorId);

    @Query("""
        select db.branch.id as branchId, count(db.id) as doctorCount
        from DoctorBranch db
        where db.branch.id in :branchIds
          and db.doctor.active = true
        group by db.branch.id
        """)
    List<BranchDoctorCount> countActiveDoctorsByBranchIds(@Param("branchIds") Collection<UUID> branchIds);

    interface BranchDoctorCount {
        UUID getBranchId();
        long getDoctorCount();
    }
}
