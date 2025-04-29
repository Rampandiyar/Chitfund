import Member from "../models/member.js";
import Branch from "../models/branch.js";
import Employee from "../models/employee.js";

// Helper function to validate references
const validateReferences = async (branchId, registeredById) => {
  const [branch, employee] = await Promise.all([
    Branch.findById(branchId),
    registeredById ? Employee.findById(registeredById) : Promise.resolve(null)
  ]);

  if (!branch) throw new Error('Branch not found');
  if (registeredById && !employee) throw new Error('Registering employee not found');
};

// @desc    Register new member
// @route   POST /api/members
export const registerMember = async (req, res) => {
  try {
    const { branch_id, registered_by, uid, mobile, phone, ...memberData } = req.body;

    // Validate references
    await validateReferences(branch_id, registered_by);

    // Check for duplicate UID or mobile
    const existingMember = await Member.findOne({
      $or: [
        { uid },
        { mobile },
        { phone }
      ]
    });

    if (existingMember) {
      const conflicts = [];
      if (existingMember.uid === uid) conflicts.push('UID');
      if (existingMember.mobile === mobile) conflicts.push('mobile');
      if (existingMember.phone === phone) conflicts.push('phone');

      return res.status(400).json({
        success: false,
        message: `Member with same ${conflicts.join(', ')} already exists`
      });
    }

    // Calculate age from DOB
    const dob = new Date(memberData.dob);
    const ageDifMs = Date.now() - dob.getTime();
    const ageDate = new Date(ageDifMs);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);

    const member = await Member.create({
      ...memberData,
      branch_id,
      registered_by: registered_by || req.employee._id,
      uid,
      mobile,
      phone,
      age
    });

    res.status(201).json({
      success: true,
      data: member
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all members
// @route   GET /api/members
export const getMembers = async (req, res) => {
  try {
    const { branch_id, active, search, minAge, maxAge } = req.query;
    const filter = {};

    if (branch_id) filter.branch_id = branch_id;
    if (active) filter.active = active === 'true';
    if (minAge || maxAge) {
      filter.age = {};
      if (minAge) filter.age.$gte = parseInt(minAge);
      if (maxAge) filter.age.$lte = parseInt(maxAge);
    }
    if (search) {
      filter.$or = [
        { mem_name: { $regex: search, $options: 'i' } },
        { member_id: { $regex: search, $options: 'i' } },
        { uid: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const members = await Member.find(filter)
      .populate('branch_id', 'branch_id bname')
      .populate('registered_by', 'emp_id emp_name')
      .sort({ registration_date: -1 });

    res.json({
      success: true,
      count: members.length,
      data: members
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get member by ID
// @route   GET /api/members/:id
export const getMemberById = async (req, res) => {
  try {
    const member = await Member.findOne({
      $or: [
        { _id: req.params.id },
        { member_id: req.params.id },
        { uid: req.params.id }
      ]
    })
    .populate('branch_id', 'branch_id bname address phone')
    .populate('registered_by', 'emp_id emp_name phone');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found"
      });
    }

    res.json({
      success: true,
      data: member
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update member
// @route   PUT /api/members/:id
export const updateMember = async (req, res) => {
  try {
    // Prevent updating certain fields
    const { member_id, uid, branch_id, registered_by, ...updateData } = req.body;

    // Validate new UID if provided
    if (uid) {
      const existing = await Member.findOne({ uid });
      if (existing && !existing._id.equals(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Member with this UID already exists"
        });
      }
    }

    const member = await Member.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { member_id: req.params.id }
        ]
      },
      updateData,
      { new: true, runValidators: true }
    )
    .populate('branch_id', 'branch_id bname')
    .populate('registered_by', 'emp_id emp_name');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found"
      });
    }

    res.json({
      success: true,
      data: member
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Toggle member status
// @route   PATCH /api/members/:id/status
export const toggleMemberStatus = async (req, res) => {
  try {
    const member = await Member.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { member_id: req.params.id }
        ]
      },
      { active: req.body.active },
      { new: true }
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found"
      });
    }

    res.json({
      success: true,
      data: {
        member_id: member.member_id,
        mem_name: member.mem_name,
        active: member.active
      },
      message: `Member ${member.active ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get member statistics
// @route   GET /api/members/stats
export const getMemberStats = async (req, res) => {
  try {
    const stats = await Member.aggregate([
      {
        $group: {
          _id: "$branch_id",
          totalMembers: { $sum: 1 },
          activeMembers: { $sum: { $cond: [{ $eq: ["$active", true] }, 1, 0] } },
          averageAge: { $avg: "$age" }
        }
      },
      {
        $lookup: {
          from: "branches",
          localField: "_id",
          foreignField: "_id",
          as: "branch"
        }
      },
      {
        $unwind: "$branch"
      },
      {
        $project: {
          _id: 0,
          branch_id: "$branch.branch_id",
          branch_name: "$branch.bname",
          totalMembers: 1,
          activeMembers: 1,
          inactiveMembers: { $subtract: ["$totalMembers", "$activeMembers"] },
          averageAge: { $round: ["$averageAge", 1] }
        }
      },
      {
        $sort: { totalMembers: -1 }
      }
    ]);

    // Get overall stats
    const overall = await Member.aggregate([
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          activeMembers: { $sum: { $cond: [{ $eq: ["$active", true] }, 1, 0] } },
          averageAge: { $avg: "$age" }
        }
      },
      {
        $project: {
          _id: 0,
          totalMembers: 1,
          activeMembers: 1,
          inactiveMembers: { $subtract: ["$totalMembers", "$activeMembers"] },
          averageAge: { $round: ["$averageAge", 1] }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        byBranch: stats,
        overall: overall[0] || {}
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete member
// @route   DELETE /api/members/:id
export const deleteMember = async (req, res) => {
  try {
    // Check if member is in any active groups
    const groupCount = await mongoose.model('Group').countDocuments({
      'members.member_id': req.params.id,
      status: 'Active'
    });

    if (groupCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete member in active groups"
      });
    }

    const member = await Member.findOneAndDelete({
      $or: [
        { _id: req.params.id },
        { member_id: req.params.id }
      ]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found"
      });
    }

    res.json({
      success: true,
      data: {
        member_id: member.member_id,
        mem_name: member.mem_name
      },
      message: "Member deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};