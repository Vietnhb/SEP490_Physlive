package com.example.backend.system.realtime;

import com.example.backend.system.realtime.controller.*;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.mock.web.*;
import org.springframework.web.context.request.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RealtimeMutationFilterTest {
    @Test void committedDomainEventRetainsSenderIdAndDoesNotBroadcastAgainInFilter() throws Exception {
        var events = mock(RealtimeEvents.class); var publisher = mock(ApplicationEventPublisher.class);
        var request = new MockHttpServletRequest("POST", "/api/appeals"); request.addHeader("X-PhysLive-Client", "teacher-browser");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        try {
            new RealtimeMutationFilter(Optional.of(events)).doFilter(request, new MockHttpServletResponse(), (req, res) ->
                new RealtimeChangePublisher(publisher).changed("/api/appeals"));
            var change = org.mockito.ArgumentCaptor.forClass(com.example.backend.system.realtime.dto.RealtimeEvent.Change.class);
            verify(publisher).publishEvent(change.capture());
            assertEquals("teacher-browser", change.getValue().clientId()); assertEquals("/api/appeals", change.getValue().path());
            verifyNoInteractions(events);
        } finally { RequestContextHolder.resetRequestAttributes(); }
    }
    @Test void otherSuccessfulWritesStillBroadcastButFailuresDoNot() throws Exception {
        var events = mock(RealtimeEvents.class); var filter = new RealtimeMutationFilter(Optional.of(events));
        filter.doFilter(new MockHttpServletRequest("POST", "/api/support/messages"), new MockHttpServletResponse(), (req, res) -> { });
        verify(events).publish("/api/support/messages", null); clearInvocations(events);
        filter.doFilter(new MockHttpServletRequest("POST", "/api/appeals"), new MockHttpServletResponse(), (req, res) -> ((jakarta.servlet.http.HttpServletResponse)res).setStatus(409));
        verifyNoInteractions(events);
    }
}
