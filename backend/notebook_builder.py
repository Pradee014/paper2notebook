import nbformat


def build_notebook(cells: list[dict]) -> str:
    """Convert a list of cell dicts into a valid .ipynb JSON string.

    Each cell must have 'cell_type' (markdown|code) and 'source' (str).
    Returns the notebook as a JSON string.
    Raises ValueError if cells is empty.
    """
    if not cells:
        raise ValueError("Cannot build notebook from empty cells list")

    nb = nbformat.v4.new_notebook()
    nb.metadata.kernelspec = {
        "display_name": "Python 3",
        "language": "python",
        "name": "python3",
    }
    nb.metadata.language_info = {
        "name": "python",
        "version": "3.11.0",
    }

    for cell_data in cells:
        cell_type = cell_data["cell_type"]
        source = cell_data["source"]

        if cell_type == "markdown":
            nb.cells.append(nbformat.v4.new_markdown_cell(source))
        elif cell_type == "code":
            nb.cells.append(nbformat.v4.new_code_cell(source))

    return nbformat.writes(nb)
