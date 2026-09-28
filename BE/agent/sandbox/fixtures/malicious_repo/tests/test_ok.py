"""conftest.py의 공격과는 무관한 평범한 테스트들.

유일한 역할은 이 리포를 정상적인 테스트 스위트처럼 보이게 만드는 것이다. pytest가 이들을
실행해 통과시키는 동안, 적대적인 conftest는 이미 import 시점에 실행을 마친 상태다.
둘 다 통과하므로 pytest는 0으로 끝나고, 무언가 시도되었다는 낌새는 전혀 남지 않는다.
"""


def test_addition():
    assert 1 + 1 == 2


def test_string():
    assert "vibe".upper() == "VIBE"
