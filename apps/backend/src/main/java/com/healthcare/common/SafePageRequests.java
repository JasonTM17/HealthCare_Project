package com.healthcare.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

/**
 * Shared guard for published catalog listings. These endpoints are permitAll;
 * a raw {@link Pageable} lets a caller request thousands of rich rows per page
 * or sort on a large text column, and an unknown property surfaces as a 500
 * via {@code PropertyReferenceException}. Normalizing clamps the page window
 * and whitelists sort properties; callers pass their entity's safe fields.
 */
public final class SafePageRequests {

    private SafePageRequests() {
    }

    public static Pageable normalize(
            Pageable pageable,
            Sort defaultSort,
            Set<String> allowedSortProperties) {
        int page = pageable == null ? 0 : pageable.getPageNumber();
        int size = pageable == null ? 20 : pageable.getPageSize();
        if (page < 0) {
            throw badRequest("page must be zero or greater");
        }
        if (size < 1 || size > 100) {
            throw badRequest("size must be between 1 and 100");
        }
        Sort sort = pageable == null || pageable.getSort().isUnsorted()
            ? defaultSort
            : pageable.getSort();
        for (Sort.Order order : sort) {
            if (!allowedSortProperties.contains(order.getProperty())) {
                throw badRequest("unsupported sort property: " + order.getProperty());
            }
        }
        return PageRequest.of(page, size, sort);
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    /**
     * Guard for admin inventory listings (HC-11). Unlike {@link #normalize},
     * these endpoints previously returned the full table and clients still
     * consume the whole array, so the default window stays large (500) and
     * oversized requests are clamped to the hard maximum instead of rejected —
     * this keeps the historical "admin can reach every record" behavior while
     * bounding worst-case reads. Ordering is fixed by the caller so pages are
     * stable and gap-free; client-supplied sort input is ignored.
     */
    public static Pageable normalizeAdminListing(
            Integer page,
            Integer size,
            int defaultSize,
            int hardMaxSize,
            Sort sort) {
        int safePage = page == null || page < 0 ? 0 : page;
        int safeSize = size == null ? defaultSize : Math.min(Math.max(size, 1), hardMaxSize);
        return PageRequest.of(safePage, safeSize, sort);
    }
}
