package com.healthcare.auth.security;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class BcryptInputLengthValidator implements ConstraintValidator<BcryptInputLength, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return PasswordInputPolicy.fitsBcrypt(value);
    }
}
