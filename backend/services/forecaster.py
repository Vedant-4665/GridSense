"""Train and serve the generation forecast."""
import joblib
import numpy as np
import pandas as pd

import config
from ml.features import FEATURE_COLUMNS, build


def train(df: pd.DataFrame):
    """
    Gradient-boosted trees over engineered features.
    Chosen over an LSTM for explainability, training speed, and tabular fit.
    """
    from xgboost import XGBRegressor

    feat = build(df)
    X, y = feat[FEATURE_COLUMNS], feat["ac_power"]

    split = int(len(X) * 0.8)
    model = XGBRegressor(
        n_estimators=400, max_depth=6, learning_rate=0.05,
        subsample=0.9, colsample_bytree=0.9, random_state=42,
    )
    model.fit(X[:split], y[:split])

    metrics = evaluate(model, X[split:], y[split:])
    config.MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, config.MODEL_PATH)
    return model, metrics


def evaluate(model, X_test, y_test) -> dict:
    """Score against a naive persistence baseline, so improvement is a real number."""
    preds = model.predict(X_test)
    mae = float(np.mean(np.abs(preds - y_test)))

    baseline = y_test.shift(1).fillna(method="bfill")   # tomorrow = today
    baseline_mae = float(np.mean(np.abs(baseline - y_test)))

    improvement = (baseline_mae - mae) / baseline_mae * 100 if baseline_mae else 0.0
    return {
        "mae": round(mae, 3),
        "baseline_mae": round(baseline_mae, 3),
        "improvement_pct": round(improvement, 2),
    }


def load():
    if not config.MODEL_PATH.exists():
        raise FileNotFoundError("Model not trained yet. Run: python seed.py --train")
    return joblib.load(config.MODEL_PATH)


def predict(df: pd.DataFrame) -> np.ndarray:
    model = load()
    return model.predict(build(df)[FEATURE_COLUMNS])


def feature_importance() -> dict:
    model = load()
    return dict(zip(FEATURE_COLUMNS, (round(float(v), 4) for v in model.feature_importances_)))
