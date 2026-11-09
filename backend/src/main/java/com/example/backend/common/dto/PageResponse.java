package com.example.backend.common.dto;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import com.example.backend.exception.ApiException;

public record PageResponse<T>(List<T> items, long totalElements, int totalPages, int page, int size) {
    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(page.getContent(), page.getTotalElements(), page.getTotalPages(), page.getNumber(), page.getSize());
    }
    public static PageRequest request(int page, int size, Sort sort) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw ApiException.badRequest("Invalid page (size must be 1-100).");
        return PageRequest.of(page, size, sort);
    }
}
