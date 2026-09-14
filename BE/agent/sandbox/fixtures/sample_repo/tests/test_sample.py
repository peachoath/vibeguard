"""샘플 테스트 스위트. 2건은 통과하고 1건은 의도적으로 실패한다.

실패하는 테스트는 일부러 넣은 것이다. 샌드박스 러너가 진짜 테스트 실패를 제대로 보고하는지
증명해야 하며, 그러려면 이 리포에서 pytest가 종료 코드 1로 끝나야 한다.
외부 의존성 없이 pytest만 있으면 된다.
"""

from calculator import add, divide


def test_add_returns_sum():
    assert add(2, 3) == 5


def test_divide_returns_quotient():
    assert divide(10, 4) == 2.5


def test_divide_by_zero_returns_none():
    # 의도적 실패: divide()가 None을 반환하지 않고 ZeroDivisionError를 던진다.
    # 이 샘플 리포가 품고 있는 버그다.
    assert divide(1, 0) is None
