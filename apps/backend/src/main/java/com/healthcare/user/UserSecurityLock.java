package com.healthcare.user;

import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/** Shared stable-row lock for auth mutations that must serialize per user. */
@Component
public class UserSecurityLock {

    private final UserRepository userRepository;

    public UserSecurityLock(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Optional<User> findByIdForUpdate(UUID userId) {
        return userRepository.findByIdForUpdate(userId);
    }

    public Optional<User> findByEmailForUpdate(String email) {
        return userRepository.findByEmailForUpdate(email);
    }
}
