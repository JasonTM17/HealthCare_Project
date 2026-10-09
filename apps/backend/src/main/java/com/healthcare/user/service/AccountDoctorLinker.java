package com.healthcare.user.service;

import com.healthcare.exception.BadRequestException;
import com.healthcare.exception.ConflictException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.user.entity.User;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/** Global governance and user locks must precede these ordered doctor locks. */
@Component
public class AccountDoctorLinker {
    private final DoctorRepository doctors;
    public AccountDoctorLinker(DoctorRepository doctors) { this.doctors = doctors; }

    public boolean apply(User target, Set<String> roles, UUID selected, boolean unlink,
                         String requestedName, boolean grantOrLink) {
        Doctor current = doctors.findByUserId(target.getId()).orElse(null);
        Map<UUID, Doctor> locked = new TreeMap<>();
        if (current != null) locked.put(current.getId(), current);
        if (selected != null) locked.put(selected, current);
        for (UUID id : List.copyOf(locked.keySet())) {
            locked.put(id, doctors.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor profile not found")));
        }
        if (current != null) current = locked.get(current.getId());
        boolean doctorRole = roles.contains("DOCTOR");
        if (!doctorRole) {
            if (selected != null) throw new BadRequestException("Doctor profile requires the DOCTOR role");
            if (current != null && !unlink) throw new ConflictException("Confirm unlinking the doctor profile before removing DOCTOR");
            if (current != null) { current.setUserId(null); doctors.save(current); return true; }
            return false;
        }
        if (!grantOrLink && !unlink && (selected == null || current != null && current.getId().equals(selected))) {
            if (current != null && !current.getFullName().equals(requestedName)) {
                throw new ConflictException("Edit the linked doctor's name in doctor management");
            }
            return false;
        }
        Doctor next = selected == null ? current : locked.get(selected);
        if (next == null || !next.isActive()) {
            throw new BadRequestException("Select an existing active doctor profile");
        }
        if (next.getUserId() != null && !next.getUserId().equals(target.getId())) {
            throw new ConflictException("Doctor profile is already linked to another account");
        }
        if (unlink && (current == null || current.getId().equals(next.getId()))) {
            throw new BadRequestException("A DOCTOR account must retain an active profile or select a replacement");
        }
        if (!next.getFullName().equals(requestedName)) {
            throw new ConflictException("Display name must match the doctor profile; edit the name in doctor management");
        }
        boolean changed = current == null || !current.getId().equals(next.getId());
        if (changed && current != null) { current.setUserId(null); doctors.saveAndFlush(current); }
        next.setUserId(target.getId());
        doctors.save(next);
        return changed;
    }
}
