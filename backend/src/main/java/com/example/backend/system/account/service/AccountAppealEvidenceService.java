package com.example.backend.system.account.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.dto.AppealContracts.*;
import com.example.backend.system.account.model.entity.AccountAppealEvidence;
import com.example.backend.system.account.repository.AccountAppealEvidenceRepository;
import java.io.*;
import java.util.*;
import javax.imageio.ImageIO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.web.multipart.MultipartFile;

@Service @RequiredArgsConstructor
@Transactional(readOnly = true)
public class AccountAppealEvidenceService {
    private final AccountAppealService appeals;
    private final AccountAppealEvidenceRepository evidence;
    public record Metadata(UUID id, String contentType) { }
    public record Image(String contentType, byte[] content) { }

    // Validate/decode before opening the appeal write transaction; the callback joins that transaction.
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public AppealResponse create(Authentication auth, CreateAppealRequest request, List<MultipartFile> files) {
        if (files == null) files = List.of();
        if (files.size() > 3) throw ApiException.badRequest("Chỉ được đính kèm tối đa 3 ảnh.");
        List<Image> images = files.stream().map(AccountAppealEvidenceService::validate).toList();
        return appeals.createAppeal(auth, request, appeal -> {
            for (Image image : images) {
                var item = new AccountAppealEvidence(); item.setAppeal(appeal);
                item.setContentType(image.contentType()); item.setContent(image.content()); evidence.save(item);
            }
        });
    }

    public List<Metadata> list(UUID appealId) {
        appeals.requireView(appealId);
        return evidence.metadata(appealId).stream().map(item -> new Metadata(item.getId(), item.getContentType())).toList();
    }

    public Image image(UUID appealId, UUID id) {
        appeals.requireView(appealId);
        var item = evidence.findByIdAndAppealId(id, appealId).orElseThrow(() -> ApiException.notFound("Không tìm thấy ảnh minh chứng."));
        return new Image(item.getContentType(), item.getContent());
    }

    static Image validate(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > 2 * 1024 * 1024)
            throw ApiException.badRequest("Mỗi ảnh minh chứng phải có dung lượng tối đa 2 MB.");
        try {
            byte[] bytes = file.getBytes();
            try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw ApiException.badRequest("Chỉ hỗ trợ ảnh JPG hoặc PNG hợp lệ.");
                var reader = readers.next();
                try {
                    String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                    if (!Set.of("jpeg", "png").contains(format)) throw ApiException.badRequest("Chỉ hỗ trợ ảnh JPG hoặc PNG.");
                    reader.setInput(input, true, true);
                    int width = reader.getWidth(0), height = reader.getHeight(0);
                    if (width <= 0 || height <= 0 || (long) width * height > 16_000_000)
                        throw ApiException.badRequest("Ảnh minh chứng tối đa 16 triệu điểm ảnh.");
                    if (reader.read(0) == null) throw ApiException.badRequest("Ảnh minh chứng không hợp lệ.");
                    return new Image(format.equals("png") ? "image/png" : "image/jpeg", bytes);
                } finally { reader.dispose(); }
            }
        } catch (IOException error) { throw ApiException.badRequest("Không đọc được ảnh minh chứng. Vui lòng chọn ảnh JPG hoặc PNG hợp lệ."); }
    }
}
