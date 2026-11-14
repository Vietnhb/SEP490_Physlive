package com.example.backend.system.account.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.dto.AppealContracts.*;
import com.example.backend.system.account.model.entity.AccountAppeal;
import com.example.backend.system.account.repository.AccountAppealEvidenceRepository;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountAppealEvidenceServiceTest {
    final AccountAppealService appeals = mock(AccountAppealService.class);
    final AccountAppealEvidenceRepository repository = mock(AccountAppealEvidenceRepository.class);
    final AccountAppealEvidenceService service = new AccountAppealEvidenceService(appeals, repository);
    MockMultipartFile png() throws Exception {
        var bytes = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", bytes);
        return new MockMultipartFile("files", "proof.png", "image/png", bytes.toByteArray());
    }
    @Test void checksImageBytesInsteadOfTrustingFileNameOrMime() throws Exception {
        var valid = png(); assertEquals("image/png", AccountAppealEvidenceService.validate(valid).contentType());
        var fake = new MockMultipartFile("files", "proof.png", "image/png", "<svg onload='alert(1)'/>".getBytes());
        assertThrows(ApiException.class, () -> AccountAppealEvidenceService.validate(fake));
        assertThrows(ApiException.class, () -> AccountAppealEvidenceService.validate(new MockMultipartFile("files", "big.png", "image/png", new byte[2097153])));
    }
    @Test void invalidOrTooManyImagesDoNotCreateAnAppeal() throws Exception {
        var file = png(); var request = new CreateAppealRequest("Unlock", "Explanation");
        assertThrows(ApiException.class, () -> service.create(null, request, List.of(file, file, file, file)));
        assertThrows(ApiException.class, () -> service.create(null, request, List.of(new MockMultipartFile("files", new byte[0]))));
        verifyNoInteractions(appeals, repository);
    }
    @Test void savesProofLinkedToCreatedAppeal() throws Exception {
        UUID id = UUID.randomUUID(); var request = new CreateAppealRequest("Unlock", "Explanation");
        var appeal = new AccountAppeal(); appeal.setId(id);
        when(appeals.createAppeal(isNull(), eq(request), any())).thenAnswer(call -> {
            java.util.function.Consumer<AccountAppeal> save = call.getArgument(2); save.accept(appeal);
            return new AppealResponse(id, 2, "test@invalid", "Test", "Unlock", "Explanation", "PENDING", null, null, null, "SCHOOL", false, true);
        });
        service.create(null, request, List.of(png()));
        var captured = org.mockito.ArgumentCaptor.forClass(com.example.backend.system.account.model.entity.AccountAppealEvidence.class);
        verify(repository).save(captured.capture()); assertEquals(appeal, captured.getValue().getAppeal());
        assertEquals("image/png", captured.getValue().getContentType()); assertTrue(captured.getValue().getContent().length > 0);
        assertNull(captured.getValue().getId(), "New evidence uses persist rather than a redundant merge lookup");
        verify(appeals, never()).requireView(any());
    }
    @Test void deniesMetadataAndImageBeforeLoadingPrivateContent() {
        UUID id = UUID.randomUUID(); when(appeals.requireView(id)).thenThrow(ApiException.forbidden("Denied"));
        assertThrows(ApiException.class, () -> service.list(id));
        assertThrows(ApiException.class, () -> service.image(id, UUID.randomUUID())); verifyNoInteractions(repository);
    }
    @Test void imageIdMustBelongToRequestedAppeal() {
        UUID appealId = UUID.randomUUID(), imageId = UUID.randomUUID();
        when(repository.findByIdAndAppealId(imageId, appealId)).thenReturn(Optional.empty());
        assertThrows(ApiException.class, () -> service.image(appealId, imageId));
        verify(appeals).requireView(appealId); verify(repository).findByIdAndAppealId(imageId, appealId);
    }
}
