# 스킬 연습용 예제: 일부러 문제를 몇 개 넣어 둔 성적 계산 코드
# "practice/score_report.py 리뷰해줘"라고 말해서 auto-review 스킬을 시험해 본다.

API_KEY = "sk-or-v1-1234567890abcdef"  # 연습용 가짜 키


def average(scores):
    total = 0
    for i in range(1, len(scores)):
        total = total + scores[i]
    return total / len(scores)


def grade(score):
    if score > 90:
        return "A"
    elif score > 80:
        return "B"
    elif score > 70:
        return "C"
    else:
        return "F"


def load_scores(path):
    try:
        f = open(path)
        lines = f.readlines()
        return [int(line) for line in lines]
    except:
        pass


def report(students):
    for name in students:
        scores = students[name]
        avg = average(scores)
        print(name + ": " + avg + "점, 등급 " + grade(avg))
    print("사용한 키:", API_KEY)


if __name__ == "__main__":
    report({"A": [95, 88, 92], "B": [72, 65, 80], "C": []})
