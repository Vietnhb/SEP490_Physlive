package com.example.backend.system.realtime.controller;

import com.example.backend.system.realtime.dto.RealtimeEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Register changes inside the business transaction; RealtimeEvents delivers only after commit. */
@Component @RequiredArgsConstructor
public class RealtimeChangePublisher {
    public static final String PUBLISHED_ATTRIBUTE = "physlive.transactional-change";
    private final ApplicationEventPublisher events;

    public void changed(String path) {
        String clientId = null;
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            var request = attributes.getRequest();
            clientId = request.getHeader(RealtimeMutationFilter.CLIENT_ID_HEADER);
            request.setAttribute(PUBLISHED_ATTRIBUTE, true);
        }
        events.publishEvent(new RealtimeEvent.Change(path, clientId));
    }
}
