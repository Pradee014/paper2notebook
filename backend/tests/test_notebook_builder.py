import json
import pytest
import nbformat

from notebook_builder import build_notebook

SAMPLE_CELLS = [
    {"cell_type": "markdown", "source": "# Attention Is All You Need\n\nReplication notebook."},
    {"cell_type": "code", "source": "import numpy as np\nimport torch"},
    {"cell_type": "markdown", "source": "## Mathematical Formulation\n\n$$Q K^T / \\sqrt{d_k}$$"},
    {"cell_type": "code", "source": "def attention(Q, K, V):\n    d_k = Q.shape[-1]\n    scores = Q @ K.T / np.sqrt(d_k)\n    return scores @ V"},
]


def test_build_notebook_returns_valid_ipynb_string():
    ipynb_str = build_notebook(SAMPLE_CELLS)
    # Must be valid JSON
    nb_dict = json.loads(ipynb_str)
    assert "cells" in nb_dict
    assert "metadata" in nb_dict
    assert nb_dict["nbformat"] == 4


def test_build_notebook_has_correct_cell_count():
    ipynb_str = build_notebook(SAMPLE_CELLS)
    nb_dict = json.loads(ipynb_str)
    assert len(nb_dict["cells"]) == 4


def test_build_notebook_preserves_cell_types():
    ipynb_str = build_notebook(SAMPLE_CELLS)
    nb_dict = json.loads(ipynb_str)
    assert nb_dict["cells"][0]["cell_type"] == "markdown"
    assert nb_dict["cells"][1]["cell_type"] == "code"


def test_build_notebook_preserves_source_content():
    ipynb_str = build_notebook(SAMPLE_CELLS)
    nb_dict = json.loads(ipynb_str)
    # nbformat stores source as a string (or list of strings)
    src = nb_dict["cells"][0]["source"]
    if isinstance(src, list):
        src = "".join(src)
    assert "Attention Is All You Need" in src


def test_build_notebook_validates_with_nbformat():
    ipynb_str = build_notebook(SAMPLE_CELLS)
    nb = nbformat.reads(ipynb_str, as_version=4)
    # nbformat.validate raises on invalid notebooks
    nbformat.validate(nb)


def test_build_notebook_code_cells_have_execution_count():
    ipynb_str = build_notebook(SAMPLE_CELLS)
    nb_dict = json.loads(ipynb_str)
    for cell in nb_dict["cells"]:
        if cell["cell_type"] == "code":
            assert "execution_count" in cell
            assert "outputs" in cell


def test_build_notebook_sets_python3_kernel():
    ipynb_str = build_notebook(SAMPLE_CELLS)
    nb_dict = json.loads(ipynb_str)
    kernel = nb_dict["metadata"].get("kernelspec", {})
    assert kernel.get("language") == "python"


def test_build_notebook_empty_cells_raises():
    with pytest.raises(ValueError, match="empty"):
        build_notebook([])
