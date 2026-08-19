package com.healthcare.storage.repository;

import com.healthcare.storage.entity.StoredFile;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface StoredFileRepository extends JpaRepository<StoredFile, UUID> {

    @EntityGraph(attributePaths = {"uploader", "patient"})
    Optional<StoredFile> findByObjectKey(String objectKey);
}
