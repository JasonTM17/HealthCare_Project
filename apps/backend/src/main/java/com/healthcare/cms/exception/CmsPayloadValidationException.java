package com.healthcare.cms.exception;

import com.healthcare.exception.BusinessException;

public class CmsPayloadValidationException extends BusinessException {

    public CmsPayloadValidationException(String message) {
        super(400, message);
    }
}
