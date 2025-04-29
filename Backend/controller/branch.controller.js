import Branch from "../models/branch.js";

// Create a new branch
export const createBranch = async (req, res) => {
    try {
        const { bname, parent_id, start_date, status } = req.body;
        
        // Check if branch name already exists
        const existingBranch = await Branch.findOne({ bname });
        if (existingBranch) {
            return res.status(400).json({ message: "Branch name already exists" });
        }

        const newBranch = new Branch({
            bname,
            parent_id,
            start_date,
            status
        });

        const savedBranch = await newBranch.save();
        res.status(201).json(savedBranch);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all branches
export const getBranches = async (req, res) => {
    try {
        const branches = await Branch.find();
        res.status(200).json(branches);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get a single branch by ID
export const getBranchById = async (req, res) => {
    try {
        const branch = await Branch.findOne({ branch_id: req.params.id });
        if (!branch) {
            return res.status(404).json({ message: "Branch not found" });
        }
        res.status(200).json(branch);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update a branch
export const updateBranch = async (req, res) => {
    try {
        const { bname, parent_id, start_date, status } = req.body;
        
        // Check if new branch name already exists (if it's being changed)
        if (bname) {
            const existingBranch = await Branch.findOne({ 
                bname, 
                branch_id: { $ne: req.params.id } 
            });
            if (existingBranch) {
                return res.status(400).json({ message: "Branch name already exists" });
            }
        }

        const updatedBranch = await Branch.findOneAndUpdate(
            { branch_id: req.params.id },
            { bname, parent_id, start_date, status },
            { new: true, runValidators: true }
        );

        if (!updatedBranch) {
            return res.status(404).json({ message: "Branch not found" });
        }

        res.status(200).json(updatedBranch);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete a branch (soft delete by changing status)
export const deleteBranch = async (req, res) => {
    try {
        const deletedBranch = await Branch.findOneAndUpdate(
            { branch_id: req.params.id },
            { status: "Inactive" },
            { new: true }
        );

        if (!deletedBranch) {
            return res.status(404).json({ message: "Branch not found" });
        }

        res.status(200).json({ 
            message: "Branch marked as inactive", 
            branch: deletedBranch 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get branches by status
export const getBranchesByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const branches = await Branch.find({ status });
        res.status(200).json(branches);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Search branches by name or ID
export const searchBranches = async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query || query.trim() === '') {
            return res.status(400).json({ message: "Search query is required" });
        }

        const branches = await Branch.find({
            $or: [
                { bname: { $regex: query, $options: 'i' } },
                { branch_id: { $regex: query, $options: 'i' } }
            ]
        });

        res.status(200).json(branches);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};