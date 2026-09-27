-- V5: Finding 중복 방지 인덱스 (런너 재전송 멱등성 보장)
-- V1의 uq_scan_rule은 rule_id 기반 중복만 방지. CVE/패키지 기반도 추가.
--
-- uq_scan_cve: 같은 스캔에서 동일 CVE + 패키지는 1건만 허용.
-- uq_scan_pkg: CVE 없는 패키지 취약점(CVE ID 미식별) 중복 방지.
--              scan + package_name + current_version 조합이 동일하면 같은 취약점으로 간주.

CREATE UNIQUE INDEX IF NOT EXISTS uq_scan_cve
    ON findings (scan_id, cve_id, package_name)
    WHERE cve_id IS NOT NULL AND package_name IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_scan_pkg
    ON findings (scan_id, package_name, current_version)
    WHERE cve_id IS NULL AND package_name IS NOT NULL AND current_version IS NOT NULL;
