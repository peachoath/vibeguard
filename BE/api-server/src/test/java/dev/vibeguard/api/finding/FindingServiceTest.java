package dev.vibeguard.api.finding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import dev.vibeguard.api.patch.PatchRepository;
import dev.vibeguard.api.patch.TestRunRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FindingServiceTest {

    @Mock FindingRepository findingRepository;
    @Mock PatchRepository patchRepository;
    @Mock TestRunRepository testRunRepository;
    @InjectMocks FindingService findingService;

    @Test
    void 상세_응답에_스캔_ID와_판정_근거_패치_존재_여부를_포함한다() {
        UUID userId = UUID.randomUUID();
        UUID scanId = UUID.randomUUID();
        Finding finding = new Finding(scanId, FindingType.SCA);
        finding.setPackageName("requests");
        finding.setRationale("공식 advisory 교차 검증 완료");
        finding.setSnippet("requests==2.28.0");
        when(findingRepository.findByIdAndUserId(finding.getId(), userId))
            .thenReturn(Optional.of(finding));
        when(patchRepository.existsByFindingId(finding.getId())).thenReturn(true);

        FindingDetailDto detail = findingService.detail(finding.getId(), userId);

        assertThat(detail.scanId()).isEqualTo(scanId);
        assertThat(detail.rationale()).isEqualTo("공식 advisory 교차 검증 완료");
        assertThat(detail.snippet()).isEqualTo("requests==2.28.0");
        assertThat(detail.hasPatch()).isTrue();
    }
}
