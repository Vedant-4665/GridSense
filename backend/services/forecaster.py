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

    df: one row per plant per block, with ac_power, capacity_kw and the raw
    weather columns. The target is capacity factor rather than kW, so the model
    can forecast a plant of a different size from the one it was trained on.
    """
    from xgboost import XGBRegressor

    feat = build(df)
    feat["baseline_kw"] = _same_block_yesterday(feat)
    X = feat[FEATURE_COLUMNS]
    y = feat["ac_power"] / feat["capacity_kw"]

    split = int(len(X) * 0.8)
    model = XGBRegressor(
        n_estimators=400, max_depth=6, learning_rate=0.05,
        subsample=0.9, colsample_bytree=0.9, random_state=42,
    )
    model.fit(X[:split], y[:split])

    metrics = evaluate(model, feat[split:])
    config.MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, config.MODEL_PATH)
    return model, metrics


def evaluate(model, test: pd.DataFrame) -> dict:
    """
    Score against a naive persistence baseline, so improvement is a real number.
    The baseline is day-ahead (tomorrow = today, block for block) because that
    is the horizon the platform forecasts at. MAE is in kW.
    """
    test = test.dropna(subset=["baseline_kw"])
    pred_kw = _capacity_factor(model, test[FEATURE_COLUMNS]) * test["capacity_kw"]
    mae = float(np.mean(np.abs(pred_kw - test["ac_power"])))
    baseline_mae = float(np.mean(np.abs(test["baseline_kw"] - test["ac_power"])))

    improvement = (baseline_mae - mae) / baseline_mae * 100 if baseline_mae else 0.0
    return {
        "mae": round(mae, 3),
        "baseline_mae": round(baseline_mae, 3),
        "improvement_pct": round(improvement, 2),
        "test_blocks": len(test),
    }


def _same_block_yesterday(feat: pd.DataFrame) -> np.ndarray:
    """Each row's actual output one day earlier, NaN where there is no history."""
    prev = feat[["plant_id", "timestamp", "ac_power"]].copy()
    prev["timestamp"] = prev["timestamp"] + pd.Timedelta(days=1)
    keys = feat[["plant_id", "timestamp"]]
    return keys.merge(prev, on=["plant_id", "timestamp"], how="left")["ac_power"].to_numpy()


def _capacity_factor(model, X) -> np.ndarray:
    return np.clip(model.predict(X), 0.0, 1.0)


def load():
    if not config.MODEL_PATH.exists():
        raise FileNotFoundError("Model not trained yet. Run: python seed.py --train")
    return joblib.load(config.MODEL_PATH)


def predict(df: pd.DataFrame, model=None) -> np.ndarray:
    """Capacity factor (0-1) per row, in timestamp order. Multiply by capacity_kw for kW."""
    if model is None:
        model = load()
    return _capacity_factor(model, build(df)[FEATURE_COLUMNS])


def feature_importance() -> dict:
    model = load()
    return dict(zip(FEATURE_COLUMNS, (round(float(v), 4) for v in model.feature_importances_)))
