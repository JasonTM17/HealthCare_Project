package com.healthcare.cms.exception;

import com.healthcare.exception.BusinessException;

public class CmsVersionConflictException extends BusinessException {

    public CmsVersionConflictException(String slotKey, long expectedVersion, long actualVersion) {
        super(409, "CMS content version conflict for slot '" + slotKey
            + "': expected " + expectedVersion + ", actual " + actualVersion);
    }
}
